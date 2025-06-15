import { Controller, Post, Body, Get, Query, Res, Req, BadRequestException } from '@nestjs/common';
import { CybersourceService, PaymentRequest } from './cybersource.service';
import { Response, Request } from 'express';

@Controller('payments')
export class CybersourceController {
    constructor(private readonly cybersourceService: CybersourceService) { }

    /**
     * Initiate payment - returns form data for Silent Order POST
     */
    @Post('initiate')
    initiatePayment(@Body() paymentData: PaymentRequest) {
        try {
            const formData = this.cybersourceService.createPaymentRequest(paymentData);
            const endpointUrl = this.cybersourceService.getEndpointUrl();

            return {
                success: true,
                formData,
                endpointUrl,
                message: 'Payment form data generated successfully'
            };
        } catch (error) {
            throw new BadRequestException(`Failed to initiate payment: ${error.message}`);
        }
    }

    /**
     * Create payment token
     */
    @Post('create-token')
    createPaymentToken(@Body() paymentData: PaymentRequest) {
        try {
            const formData = this.cybersourceService.createTokenRequest(paymentData);
            const endpointUrl = this.cybersourceService.getEndpointUrl().replace('/pay', '/token/create');

            return {
                success: true,
                formData,
                endpointUrl,
                message: 'Token creation form data generated successfully'
            };
        } catch (error) {
            throw new BadRequestException(`Failed to create token request: ${error.message}`);
        }
    }

    /**
     * Process payment with token
     */
    @Post('pay-with-token')
    payWithToken(@Body() tokenPaymentData: {
        paymentToken: string;
        amount: string;
        currency: string;
        referenceNumber: string;
    }) {
        try {
            const formData = this.cybersourceService.createTokenPaymentRequest(
                tokenPaymentData.paymentToken,
                tokenPaymentData.amount,
                tokenPaymentData.currency,
                tokenPaymentData.referenceNumber
            );
            const endpointUrl = this.cybersourceService.getEndpointUrl();

            return {
                success: true,
                formData,
                endpointUrl,
                message: 'Token payment form data generated successfully'
            };
        } catch (error) {
            throw new BadRequestException(`Failed to create token payment: ${error.message}`);
        }
    }

    /**
     * Handle payment response from Cybersource (webhook endpoint)
     */
    @Post('callback')
    handlePaymentCallback(@Body() responseData: Record<string, string>) {
        try {
            const processedResponse = this.cybersourceService.processPaymentResponse(responseData);

            // Handle different decision types
            switch (processedResponse.decision) {
                case 'ACCEPT':
                    // Payment successful
                    console.log('Payment accepted:', processedResponse.transactionId);
                    break;
                case 'DECLINE':
                    // Payment declined
                    console.log('Payment declined:', processedResponse.reasonCode);
                    break;
                case 'REVIEW':
                    // Payment needs manual review
                    console.log('Payment under review:', processedResponse.transactionId);
                    break;
                case 'ERROR':
                    // Error occurred
                    console.log('Payment error:', processedResponse.message);
                    break;
                default:
                    console.log('Unknown payment status:', processedResponse.decision);
            }

            return {
                success: true,
                data: processedResponse,
                message: 'Payment response processed successfully'
            };
        } catch (error) {
            throw new BadRequestException(`Failed to process payment response: ${error.message}`);
        }
    }

    /**
     * Generate payment form HTML for testing
     */
    @Get('form')
    generatePaymentForm(@Query() query: any, @Res() res: Response) {
        const samplePaymentData: PaymentRequest = {
            amount: query.amount || '100.00',
            currency: query.currency || 'USD',
            referenceNumber: `REF-${Date.now()}`,
            billToForename: 'John',
            billToSurname: 'Doe',
            billToEmail: 'john.doe@example.com',
            billToAddressLine1: '123 Main St',
            billToAddressCity: 'San Francisco',
            billToAddressState: 'CA',
            billToAddressCountry: 'US',
            billToAddressPostalCode: '94105',
            billToPhone: '555-123-4567'
        };

        const formData = this.cybersourceService.createPaymentRequest(samplePaymentData);
        const endpointUrl = this.cybersourceService.getEndpointUrl();

        const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cybersource Payment Test</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="text"], select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            button { background-color: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background-color: #005a87; }
            .hidden { display: none; }
        </style>
    </head>
    <body>
        <h1>Cybersource Payment Form</h1>
        <form action="${endpointUrl}" method="post">
            ${Object.entries(formData).map(([key, value]) =>
            `<input type="hidden" name="${key}" value="${value}" />`
        ).join('\n            ')}
            
            <div class="form-group">
                <label for="card_type">Card Type:</label>
                <select name="card_type" required>
                    <option value="">Select Card Type</option>
                    <option value="001">Visa</option>
                    <option value="002">Mastercard</option>
                    <option value="003">American Express</option>
                    <option value="004">Discover</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="card_number">Card Number:</label>
                <input type="text" name="card_number" placeholder="4111111111111111" required />
            </div>
            
            <div class="form-group">
                <label for="card_expiry_date">Expiry Date (MM-YYYY):</label>
                <input type="text" name="card_expiry_date" placeholder="12-2025" required />
            </div>
            
            <div class="form-group">
                <label for="card_cvn">CVN:</label>
                <input type="text" name="card_cvn" placeholder="123" required />
            </div>
            
            <button type="submit">Pay $${formData.amount}</button>
        </form>
        
        <h3>Form Data (for debugging):</h3>
        <pre>${JSON.stringify(formData, null, 2)}</pre>
    </body>
    </html>
    `;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }


    @Post('response')
    async handlePaymentResponse(
        @Body() responseData: Record<string, string>,
        @Res() res: Response
    ) {
        try {
            console.log('Received payment response from Cybersource:', responseData);

            // Process and verify the response
            const processedResponse = this.cybersourceService.processPaymentResponse(responseData);

            // Prepare data for the response page
            const responsePageData = {
                success: processedResponse.decision === 'ACCEPT',
                decision: processedResponse.decision,
                reasonCode: processedResponse.reasonCode,
                transactionId: processedResponse.transactionId,
                authCode: processedResponse.authCode,
                authAmount: processedResponse.authAmount,
                message: this.getPaymentMessage(processedResponse.decision, processedResponse.reasonCode),
                timestamp: new Date().toISOString(),
                // Pass through request data for display
                orderReference: responseData.req_reference_number,
                amount: responseData.req_amount,
                currency: responseData.req_currency,
                customerName: `${responseData.req_bill_to_forename} ${responseData.req_bill_to_surname}`,
                customerEmail: responseData.req_bill_to_email
            };

            // Log the transaction result for your records
            await this.logTransactionResult(responsePageData);

            // Redirect to your frontend response page with the data
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const queryParams = new URLSearchParams({
                success: responsePageData.success.toString(),
                decision: responsePageData.decision,
                transactionId: responsePageData.transactionId || '',
                orderReference: responsePageData.orderReference || '',
                amount: responsePageData.amount || '',
                reasonCode: responsePageData.reasonCode || ''
            });

            return res.redirect(`${frontendUrl}/payment-result?${queryParams.toString()}`);

        } catch (error) {
            console.error('Error processing payment response:', error);

            // Redirect to error page
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return res.redirect(`${frontendUrl}/payment-result?success=false&error=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * Alternative: Serve HTML response page directly from backend
     */
    @Post('response-page')
    async serveResponsePage(
        @Body() responseData: Record<string, string>,
        @Res() res: Response
    ) {
        try {
            const processedResponse = this.cybersourceService.processPaymentResponse(responseData);

            const isSuccess = processedResponse.decision === 'ACCEPT';
            const message = this.getPaymentMessage(processedResponse.decision, processedResponse.reasonCode);

            // Generate HTML response page
            const html = this.generateResponsePageHTML({
                success: isSuccess,
                decision: processedResponse.decision,
                transactionId: processedResponse.transactionId,
                orderReference: responseData.req_reference_number,
                amount: responseData.req_amount,
                currency: responseData.req_currency,
                message: message,
                customerName: `${responseData.req_bill_to_forename} ${responseData.req_bill_to_surname}`
            });

            res.setHeader('Content-Type', 'text/html');
            return res.send(html);

        } catch (error) {
            console.error('Error processing payment response:', error);

            const errorHtml = this.generateErrorPageHTML(error.message);
            res.setHeader('Content-Type', 'text/html');
            return res.send(errorHtml);
        }
    }

    private getPaymentMessage(decision: string, reasonCode: string): string {
        switch (decision) {
            case 'ACCEPT':
                return 'Your payment has been processed successfully!';
            case 'DECLINE':
                return 'Your payment was declined. Please try again with a different payment method.';
            case 'REVIEW':
                return 'Your payment is under review. We will contact you shortly.';
            case 'ERROR':
                return 'There was an error processing your payment. Please try again.';
            case 'CANCEL':
                return 'Payment was cancelled.';
            default:
                return `Payment status: ${decision}`;
        }
    }

    private async logTransactionResult(data: any): Promise<void> {
        // Log to your database or external service
        console.log('Transaction Result:', {
            success: data.success,
            transactionId: data.transactionId,
            orderReference: data.orderReference,
            amount: data.amount,
            timestamp: data.timestamp
        });

        // TODO: Save to database, send notifications, etc.
    }

    private generateResponsePageHTML(data: any): string {
        const statusColor = data.success ? '#4caf50' : '#f44336';
        const statusIcon = data.success ? '✅' : '❌';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment ${data.success ? 'Successful' : 'Failed'}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f5f5f5;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 500px;
                width: 90%;
            }
            .status-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            .status-title {
                color: ${statusColor};
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .status-message {
                color: #666;
                font-size: 16px;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            .details {
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                border-bottom: 1px solid #eee;
                padding-bottom: 8px;
            }
            .detail-row:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            .detail-label {
                font-weight: bold;
                color: #333;
            }
            .detail-value {
                color: #666;
            }
            .button {
                background-color: #007cba;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                display: inline-block;
                margin: 10px;
                transition: background-color 0.3s;
            }
            .button:hover {
                background-color: #005a87;
            }
            .button-secondary {
                background-color: #6c757d;
            }
            .button-secondary:hover {
                background-color: #545b62;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status-icon">${statusIcon}</div>
            <h1 class="status-title">Payment ${data.success ? 'Successful' : 'Failed'}</h1>
            <p class="status-message">${data.message}</p>
            
            <div class="details">
                ${data.transactionId ? `
                <div class="detail-row">
                    <span class="detail-label">Transaction ID:</span>
                    <span class="detail-value">${data.transactionId}</span>
                </div>` : ''}
                ${data.orderReference ? `
                <div class="detail-row">
                    <span class="detail-label">Order Reference:</span>
                    <span class="detail-value">${data.orderReference}</span>
                </div>` : ''}
                ${data.amount ? `
                <div class="detail-row">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${data.currency} ${data.amount}</span>
                </div>` : ''}
                ${data.customerName ? `
                <div class="detail-row">
                    <span class="detail-label">Customer:</span>
                    <span class="detail-value">${data.customerName}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${data.decision}</span>
                </div>
            </div>

            <div style="margin-top: 30px;">
                ${data.success ?
                `<a href="${frontendUrl}/order-confirmation/${data.orderReference}" class="button">View Order Details</a>` :
                `<a href="${frontendUrl}/checkout" class="button">Try Again</a>`
            }
                <a href="${frontendUrl}" class="button button-secondary">Continue Shopping</a>
            </div>
        </div>

        <script>
            // Auto-redirect after successful payment (optional)
            ${data.success ? `
            setTimeout(() => {
                window.location.href = '${frontendUrl}/order-confirmation/${data.orderReference}';
            }, 5000);
            ` : ''}
        </script>
    </body>
    </html>
    `;
    }

    private generateErrorPageHTML(errorMessage: string): string {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Error</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f5f5f5;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 500px;
                width: 90%;
            }
            .error-icon {
                font-size: 64px;
                color: #f44336;
                margin-bottom: 20px;
            }
            .error-title {
                color: #f44336;
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .error-message {
                color: #666;
                font-size: 16px;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            .button {
                background-color: #007cba;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                display: inline-block;
                margin: 10px;
                transition: background-color 0.3s;
            }
            .button:hover {
                background-color: #005a87;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-icon">⚠️</div>
            <h1 class="error-title">Payment Error</h1>
            <p class="error-message">
                There was an error processing your payment: ${errorMessage}
            </p>
            
            <div style="margin-top: 30px;">
                <a href="${frontendUrl}/checkout" class="button">Try Again</a>
                <a href="${frontendUrl}" class="button" style="background-color: #6c757d;">Continue Shopping</a>
            </div>
        </div>
    </body>
    </html>
    `;
    }

}