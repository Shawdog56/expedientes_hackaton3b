import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings
from app.core.seguridad.errores import TokenInvalido
from app.core.seguridad.tokens import emitir_token, verificar_token

AUD = "expedientes-api"


def _par():
    clave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    privada = clave.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    publica = clave.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return privada, publica


@pytest.fixture(scope="module")
def hospital():
    return _par()


@pytest.fixture(scope="module")
def api():
    return _par()


@pytest.fixture(scope="module")
def intruso():
    return _par()


def _emitir(hospital, **kw):
    return emitir_token(emisor="hospital", audiencia=AUD, clave_privada_pem=hospital[0], **kw)


def _verificar(token, hospital, **kw):
    return verificar_token(
        token, claves_emisores={"hospital": hospital[1]}, audiencia=AUD, **kw
    )


def test_token_firmado_valido(hospital):
    claims = _verificar(_emitir(hospital, extra={"scope": "leer"}), hospital)
    assert claims["iss"] == "hospital" and claims["scope"] == "leer" and claims["jti"]


def test_token_cifrado_ida_y_vuelta(hospital, api):
    token = _emitir(hospital, clave_publica_destino_pem=api[1])
    assert token.count(".") == 4
    claims = _verificar(token, hospital, clave_privada_cifrado_pem=api[0])
    assert claims["iss"] == "hospital"


def test_token_cifrado_no_se_abre_con_otra_clave(hospital, api, intruso):
    token = _emitir(hospital, clave_publica_destino_pem=api[1])
    with pytest.raises(TokenInvalido):
        _verificar(token, hospital, clave_privada_cifrado_pem=intruso[0])


def test_api_sin_clave_de_cifrado_rechaza_jwe(hospital, api):
    with pytest.raises(TokenInvalido):
        _verificar(_emitir(hospital, clave_publica_destino_pem=api[1]), hospital)


def test_exigir_cifrado_rechaza_token_solo_firmado(hospital, api):
    with pytest.raises(TokenInvalido):
        _verificar(_emitir(hospital), hospital, exigir_cifrado=True, clave_privada_cifrado_pem=api[0])


def test_firma_de_otro_emisor_se_rechaza(hospital, intruso):
    falso = emitir_token(emisor="hospital", audiencia=AUD, clave_privada_pem=intruso[0])
    with pytest.raises(TokenInvalido):
        _verificar(falso, hospital)


def test_emisor_desconocido(hospital, intruso):
    otro = emitir_token(emisor="otro", audiencia=AUD, clave_privada_pem=intruso[0])
    with pytest.raises(TokenInvalido):
        _verificar(otro, hospital)


def test_expirado_y_audiencia_incorrecta(hospital):
    with pytest.raises(TokenInvalido):
        _verificar(_emitir(hospital, ttl=60, ahora=1_000), hospital, ahora=1_000 + 60 + 31)
    token = emitir_token(emisor="hospital", audiencia="otra-api", clave_privada_pem=hospital[0])
    with pytest.raises(TokenInvalido):
        _verificar(token, hospital)


def test_vida_demasiado_larga_se_rechaza(hospital):
    with pytest.raises(TokenInvalido):
        _verificar(_emitir(hospital, ttl=3600), hospital)


def test_alg_none_y_basura_se_rechazan(hospital):
    import base64
    import json

    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    sin_firma = f"{b64({'alg': 'none', 'kid': 'hospital'})}.{b64({'iss': 'hospital'})}."
    for malo in (sin_firma, "x.y.z", "no-es-token", ""):
        with pytest.raises(TokenInvalido):
            _verificar(malo, hospital)


def test_hs256_con_la_clave_publica_como_secreto_se_rechaza(hospital):
    import base64
    import hashlib
    import hmac
    import json

    def b64(b):
        return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

    cab = b64(json.dumps({"alg": "HS256", "kid": "hospital"}).encode())
    cuerpo = b64(json.dumps({"iss": "hospital", "aud": AUD}).encode())
    firma = b64(hmac.new(hospital[1], f"{cab}.{cuerpo}".encode(), hashlib.sha256).digest())
    with pytest.raises(TokenInvalido):
        _verificar(f"{cab}.{cuerpo}.{firma}", hospital)


@pytest.fixture
def auth_activa(monkeypatch, tmp_path, hospital, api):
    emisores = tmp_path / "entidades"
    emisores.mkdir()
    (emisores / "hospital.pem").write_bytes(hospital[1])
    privada = tmp_path / "api_privada.pem"
    privada.write_bytes(api[0])
    monkeypatch.setattr(settings, "auth_requerida", True)
    monkeypatch.setattr(settings, "auth_claves_emisores_dir", emisores)
    monkeypatch.setattr(settings, "auth_clave_cifrado_privada", privada)
    monkeypatch.setattr(settings, "auth_audiencia", AUD)


def test_api_rechaza_sin_token(client, auth_activa):
    respuesta = client.get("/api/expedientes")
    assert respuesta.status_code == 401
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_api_rechaza_token_invalido(client, auth_activa):
    assert client.get("/api/expedientes", headers={"Authorization": "Bearer basura"}).status_code == 401
    assert client.get("/api/expedientes", headers={"Authorization": "Basic abc"}).status_code == 401


def test_api_acepta_token_firmado_y_cifrado(client, auth_activa, hospital, api):
    for token in (_emitir(hospital), _emitir(hospital, clave_publica_destino_pem=api[1])):
        respuesta = client.get("/api/expedientes", headers={"Authorization": f"Bearer {token}"})
        assert respuesta.status_code == 200


def test_health_queda_abierto(client, auth_activa):
    assert client.get("/api/health").status_code == 200


def test_auth_apagada_por_defecto_no_pide_token(client):
    assert client.get("/api/expedientes").status_code == 200


def test_mala_configuracion_responde_503(client, monkeypatch, hospital):
    monkeypatch.setattr(settings, "auth_requerida", True)
    monkeypatch.setattr(settings, "auth_claves_emisores_dir", None)
    token = _emitir(hospital)
    assert client.get("/api/expedientes", headers={"Authorization": f"Bearer {token}"}).status_code == 503


def test_la_decision_final_registra_la_entidad_que_decide(client, auth_activa, hospital):
    from tests.test_expedientes import pdf_bytes

    cabecera = {"Authorization": f"Bearer {_emitir(hospital)}"}
    creado = client.post(
        "/api/expedientes",
        files=[("archivos", ("escritura.pdf", pdf_bytes(), "application/pdf"))],
        headers=cabecera,
    )
    assert creado.status_code == 201
    url = f"/api/expedientes/{creado.json()['id']}/decision"
    assert client.put(url, json={"decision": "aceptado"}).status_code == 401
    r = client.put(url, json={"decision": "aceptado"}, headers=cabecera)
    assert r.status_code == 200 and r.json()["decidido_por"] == "hospital"
