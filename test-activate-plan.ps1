$webhookUrl = 'http://localhost:5001/tradutor-profissional-ai/us-central1/kiwifyWebhook'

$payload = @{
    type = 'order.paid'
    order_id = 'TEST-TRIAL-' + (Get-Date -Format 'yyyyMMddHHmmss')
    order_ref = 'TEST-NARDOTO-LABS'
    Customer = @{
        email = 'tharcisionardoto@gmail.com'
        full_name = 'Tharcisio Nardoto'
        first_name = 'Tharcisio'
    }
    Product = @{
        product_name = 'Tradutor Profissional AI - BÁSICO'
    }
} | ConvertTo-Json -Depth 3

Write-Host ''
Write-Host '=== ATIVANDO PLANO BÁSICO ===' -ForegroundColor Cyan
Write-Host 'Email: tharcisionardoto@gmail.com' -ForegroundColor Yellow
Write-Host ''

try {
    $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 30
    Write-Host ''
    Write-Host '✅ Plano BÁSICO ativado!' -ForegroundColor Green
    Write-Host 'Recarregue o dashboard (F5) para ver as mudanças' -ForegroundColor Yellow
} catch {
    Write-Host ''
    Write-Host '❌ Erro:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
