$webhookUrl = 'https://us-central1-tradutor-profissional-ai.cloudfunctions.net/kiwifyWebhook'

# Payload completo com produto VIP
$payload = @{
    type = 'order.paid'
    order_id = 'FINAL-FIX-' + (Get-Date -Format 'yyyyMMddHHmmss')
    order_ref = 'FINAL-FIX-VIP'
    Product = @{
        product_id = 'vip'
        product_name = 'Tradutor Profissional AI - VIP'
    }
    Customer = @{
        email = 'tharcisionardoto@gmail.com'
        full_name = 'Tharcisio Nardoto'
        first_name = 'Tharcisio'
    }
} | ConvertTo-Json -Depth 3

Write-Host ''
Write-Host '=== CORRIGINDO PLANO FINAL ===' -ForegroundColor Cyan
Write-Host 'Ativando VIP com TODOS os campos...' -ForegroundColor Yellow
Write-Host ''

try {
    $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 30
    Write-Host ''
    Write-Host '✅ PLANO VIP ATIVADO CORRETAMENTE!' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Campos que foram atualizados:' -ForegroundColor White
    Write-Host '  plan: vip' -ForegroundColor Green
    Write-Host '  isPro: true' -ForegroundColor Green
    Write-Host '  features: [all-features]' -ForegroundColor Green
    Write-Host ''
    Write-Host 'RECARREGUE O DASHBOARD AGORA (F5)!' -ForegroundColor Yellow
} catch {
    Write-Host ''
    Write-Host '❌ Erro:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
