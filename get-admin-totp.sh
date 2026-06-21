#!/bin/bash

# Obtener secreto TOTP de la base de datos
SECRET=$(PGPASSWORD="grivyzom@100110" psql -h localhost -U turismo_user -d app-turismo -t -A -c "SELECT totp_secret FROM admin_users WHERE email = 'admin@turismomap.com';")

if [ -z "$SECRET" ] || [ "$SECRET" == "N" ] || [ "$SECRET" == "NULL" ]; then
  echo "❌ El 2FA no está configurado aún o está listo para escanear en la UI (totp_ready = false)."
  exit 1
fi

# Generar el código de 6 dígitos usando Python
CODE=$(python3 -c "
import hmac, hashlib, time, struct, base64
secret = \"$SECRET\"
padding_len = (8 - len(secret) % 8) % 8
padded = secret + \"=\" * padding_len
key = base64.b32decode(padded, casefold=True)
counter = int(time.time() / 30)
msg = struct.pack(\">Q\", counter)
hs = hmac.new(key, msg, hashlib.sha1).digest()
offset = hs[-1] & 0x0f
val = struct.unpack(\">I\", hs[offset:offset+4])[0] & 0x7fffffff
print(f\"{val % 1000000:06d}\")
")

echo "=========================================="
echo "🔑 Código 2FA temporal (cambia cada 30s):"
echo "👉 $CODE"
echo "=========================================="
