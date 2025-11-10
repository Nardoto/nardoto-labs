$webhookUrl = 'https://us-central1-tradutor-profissional-ai.cloudfunctions.net/kiwifyWebhook'

$payload = @{
    type = 'order.paid'
    order_id = 'MANUAL-FIX-' + (Get-Date -Format 'yyyyMMddHHmmss')
    order_ref = 'MANUAL-FIX-ACCOUNT'
    Customer = @{
        email = 'tharcisionardoto@gmail.com'
        full_name = 'Tharcisio Nardoto'
        first_name = 'Tharcisio'
    }
    Product = @{
        product_name = 'Tradutor Profissional AI - VIP'
    }
} | ConvertTo-Json -Depth 3

Write-Host ''
Write-Host '=== CORRIGINDO SUA CONTA ===' -ForegroundColor Cyan
Write-Host 'Ativando plano VIP completo...' -ForegroundColor Yellow
Write-Host ''

try {
    $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 30
    Write-Host ''
    Write-Host '✅ CONTA CORRIGIDA!' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Agora voce tem:' -ForegroundColor Green
    Write-Host '  Plano: VIP' -ForegroundColor White
    Write-Host '  Feature: all-features (TUDO liberado)' -ForegroundColor White
    Write-Host ''
    Write-Host 'RECARREGUE O DASHBOARD: https://nardoto-labs.web.app/dashboard.html' -ForegroundColor Yellow
} catch {
    Write-Host ''
    Write-Host '❌ Erro:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
