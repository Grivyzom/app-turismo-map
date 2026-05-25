#!/usr/bin/env pwsh

# Datos de registro
$body = @{
    email = "carlos.ciudadano@turismo.com"
    password = "Password123!"
    name = "Carlos Ramírez"
    userType = "ciudadano"
} | ConvertTo-Json

Write-Host "🔐 TESTEO DE REGISTRO"
Write-Host "====================="
Write-Host "Email: carlos.ciudadano@turismo.com"
Write-Host "Nombre: Carlos Ramírez"
Write-Host "Tipo: ciudadano"
Write-Host ""

Write-Host "Enviando solicitud de registro..."
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8080/auth/register' `
        -Method POST `
        -Body $body `
        -ContentType 'application/json' `
        -UseBasicParsing
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Registro exitoso!"
    Write-Host "Response:"
    $result | ConvertTo-Json
} catch {
    Write-Host "❌ Error en el registro:"
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "🔑 TESTEO DE LOGIN"
Write-Host "=================="

$loginBody = @{
    email = "carlos.ciudadano@turismo.com"
    password = "Password123!"
} | ConvertTo-Json

Write-Host "Email: carlos.ciudadano@turismo.com"
Write-Host "Contraseña: Password123!"
Write-Host ""

Write-Host "Enviando solicitud de login..."
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8080/auth/login' `
        -Method POST `
        -Body $loginBody `
        -ContentType 'application/json' `
        -UseBasicParsing
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Login exitoso!"
    Write-Host "Response:"
    $result | ConvertTo-Json
} catch {
    Write-Host "❌ Error en el login:"
    Write-Host $_.Exception.Message
}
