#!/usr/bin/env pwsh

# Datos de registro
$body = @{
    email = "sofia.ciudadana@turismo.com"
    password = "MiContraseña2026!"
    name = "Sofía García"
    userType = "ciudadano"
} | ConvertTo-Json

Write-Host "TESTEO DE REGISTRO"
Write-Host "=================="
Write-Host "Email: sofia.ciudadana@turismo.com"
Write-Host "Nombre: Sofía García"
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
    
    Write-Host "STATUS: EXITO"
    Write-Host "Response:"
    Write-Host ($result | ConvertTo-Json)
} catch {
    Write-Host "STATUS: ERROR"
    Write-Host ($_.Exception.Response | Select-Object StatusCode).StatusCode
    Write-Host ($_.Exception.Response.Content)
}

Write-Host ""
Write-Host "TESTEO DE LOGIN"
Write-Host "==============="

$loginBody = @{
    email = "sofia.ciudadana@turismo.com"
    password = "MiContraseña2026!"
} | ConvertTo-Json

Write-Host "Email: sofia.ciudadana@turismo.com"
Write-Host "Contraseña: MiContraseña2026!"
Write-Host ""

Write-Host "Enviando solicitud de login..."
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8080/auth/login' `
        -Method POST `
        -Body $loginBody `
        -ContentType 'application/json' `
        -UseBasicParsing
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "STATUS: EXITO"
    Write-Host "Response:"
    Write-Host ($result | ConvertTo-Json)
} catch {
    Write-Host "STATUS: ERROR"
    Write-Host ($_.Exception.Response | Select-Object StatusCode).StatusCode
}
