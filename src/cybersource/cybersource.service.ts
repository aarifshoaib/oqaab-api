import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PaymentRequest {
    amount: string;
    currency: string;
    referenceNumber: string;
    billToForename: string;
    billToSurname: string;
    billToEmail: string;
    billToAddressLine1: string;
    billToAddressCity: string;
    billToAddressState: string;
    billToAddressCountry: string;
    billToAddressPostalCode: string;
    billToPhone?: string;
    locale?: string;
    paymentMethod?: string;
    transactionType?: 'authorization' | 'sale'; // Added transaction type option
}

export interface CybersourceResponse {
    decision: string;
    reasonCode: string;
    transactionId?: string;
    authCode?: string;
    authAmount?: string;
    authTime?: string;
    message?: string;
    invalidFields?: string;
    signature: string;
    signedFieldNames: string;
    [key: string]: any;
}

export interface CaptureRequest {
    transactionId: string;
    amount?: string;
    currency: string;
    referenceNumber: string;
}

@Injectable()
export class CybersourceService {
    private readonly accessKey: string;
    private readonly profileId: string;
    private readonly secretKey: string;
    private readonly testEndpoint: string;
    private readonly productionEndpoint: string;
    private readonly isProduction: boolean;

    constructor(private configService: ConfigService) {
        this.accessKey = this.configService.get<string>('CYBERSOURCE_ACCESS_KEY');
        this.profileId = this.configService.get<string>('CYBERSOURCE_PROFILE_ID');
        this.secretKey = this.configService.get<string>('CYBERSOURCE_SECRET_KEY');
        this.testEndpoint = 'https://testsecureacceptance.cybersource.com/silent/pay';
        this.productionEndpoint = 'https://secureacceptance.cybersource.com/silent/pay';
        this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';

        // Validate configuration
        this.validateConfiguration();
    }

    /**
     * Validate configuration
     */
    private validateConfiguration(): void {
        const missingVars: string[] = [];

        if (!this.accessKey) {
            missingVars.push('CYBERSOURCE_ACCESS_KEY');
        }
        if (!this.profileId) {
            missingVars.push('CYBERSOURCE_PROFILE_ID');
        }
        if (!this.secretKey) {
            missingVars.push('CYBERSOURCE_SECRET_KEY');
        }

        if (missingVars.length > 0) {
            throw new BadRequestException(
                `Missing required environment variables: ${missingVars.join(', ')}`
            );
        }

        console.log('✅ Cybersource configuration loaded successfully');
        console.log(`Environment: ${this.isProduction ? 'Production' : 'Test'}`);
    }

    /**
     * Generate current timestamp in Cybersource format
     * Format: yyyy-MM-ddTHH:mm:ssZ (ISO 8601 UTC)
     */
    private getCurrentTimestamp(): string {
        const now = new Date();

        // Ensure we're working with UTC
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');

        // Format: YYYY-MM-DDTHH:mm:ssZ
        const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;

        console.log('Generated timestamp:', timestamp);
        return timestamp;
    }

    /**
     * Validate timestamp format for Cybersource
     */
    private validateTimestamp(timestamp: string): boolean {
        // Expected format: YYYY-MM-DDTHH:mm:ssZ
        const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

        if (!timestampRegex.test(timestamp)) {
            console.error('Invalid timestamp format:', timestamp);
            return false;
        }

        // Check if the timestamp is within acceptable range
        const timestampDate = new Date(timestamp);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);

        if (timestampDate < fiveMinutesAgo || timestampDate > oneMinuteFromNow) {
            console.error('Timestamp out of acceptable range:', timestamp);
            return false;
        }

        return true;
    }

    /**
     * Enhanced signature generation with debugging
     */
    private generateSignature(params: Record<string, string>, signedFieldNames: string[]): string {
        console.log('Generating signature for fields:', signedFieldNames);

        const dataToSign = signedFieldNames
            .map(field => {
                const value = params[field] || '';
                console.log(`  ${field} = ${value}`);
                return `${field}=${value}`;
            })
            .join(',');

        console.log('Data to sign:', dataToSign);

        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(dataToSign)
            .digest('base64');

        console.log('Generated signature:', signature);
        return signature;
    }

    /**
     * Enhanced signature verification with debugging
     */
    private verifySignature(response: Record<string, string>): boolean {
        try {
            const signedFieldNames = response.signed_field_names?.split(',') || [];
            const receivedSignature = response.signature;

            if (!receivedSignature || !signedFieldNames.length) {
                console.error('Missing signature or signed field names in response');
                return false;
            }

            console.log('Verifying signature for fields:', signedFieldNames);

            const dataToSign = signedFieldNames
                .map(field => {
                    const value = response[field] || '';
                    console.log(`  ${field} = ${value}`);
                    return `${field}=${value}`;
                })
                .join(',');

            console.log('Response data to verify:', dataToSign);

            const expectedSignature = crypto
                .createHmac('sha256', this.secretKey)
                .update(dataToSign)
                .digest('base64');

            console.log('Expected signature:', expectedSignature);
            console.log('Received signature:', receivedSignature);

            const isValid = expectedSignature === receivedSignature;
            console.log('Signature verification result:', isValid);

            return isValid;

        } catch (error) {
            console.error('Error during signature verification:', error);
            return false;
        }
    }

    /**
     * Generate UUID for transaction
     */
    private generateUUID(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Create payment request parameters with enhanced validation
     * Now supports both authorization and sale transaction types
     */
    createPaymentRequest(paymentData: PaymentRequest): Record<string, string> {
        const transactionUuid = this.generateUUID();
        const signedDateTime = this.getCurrentTimestamp();

        // Validate the generated timestamp
        if (!this.validateTimestamp(signedDateTime)) {
            throw new BadRequestException('Invalid timestamp generated');
        }

        const locale = paymentData.locale || 'en';
        const paymentMethod = paymentData.paymentMethod || 'card';
        // Default to 'sale' for immediate capture, or use provided transactionType
        const transactionType = paymentData.transactionType || 'sale';

        console.log(`Creating ${transactionType} payment request for amount: ${paymentData.amount}`);

        // Build request parameters
        const params: Record<string, string> = {
            access_key: this.accessKey,
            profile_id: this.profileId,
            transaction_uuid: transactionUuid,
            signed_date_time: signedDateTime,
            locale: locale,
            transaction_type: transactionType, // Now configurable
            reference_number: paymentData.referenceNumber,
            amount: paymentData.amount,
            currency: paymentData.currency,
            payment_method: paymentMethod,
            bill_to_forename: paymentData.billToForename,
            bill_to_surname: paymentData.billToSurname,
            bill_to_email: paymentData.billToEmail,
            bill_to_address_line1: paymentData.billToAddressLine1,
            bill_to_address_city: paymentData.billToAddressCity,
            bill_to_address_state: paymentData.billToAddressState,
            bill_to_address_country: paymentData.billToAddressCountry,
            bill_to_address_postal_code: paymentData.billToAddressPostalCode,
        };

        // Add optional phone number
        if (paymentData.billToPhone) {
            params.bill_to_phone = paymentData.billToPhone;
        }

        // Define signed fields in the EXACT order Cybersource expects
        const signedFieldNames = [
            'access_key',
            'profile_id',
            'transaction_uuid',
            'signed_date_time',
            'locale',
            'transaction_type',
            'reference_number',
            'amount',
            'currency',
            'payment_method',
            'bill_to_forename',
            'bill_to_surname',
            'bill_to_email',
            'bill_to_address_line1',
            'bill_to_address_city',
            'bill_to_address_state',
            'bill_to_address_country',
            'bill_to_address_postal_code'
        ];

        // Add phone to signed fields if present (before signed_field_names)
        if (paymentData.billToPhone) {
            signedFieldNames.push('bill_to_phone');
        }

        // Add the meta fields at the end
        signedFieldNames.push('signed_field_names');
        signedFieldNames.push('unsigned_field_names');

        // Unsigned fields (customer enters these)
        const unsignedFieldNames = [
            'card_type',
            'card_number',
            'card_expiry_date',
            'card_cvn'
        ];

        params.signed_field_names = signedFieldNames.join(',');
        params.unsigned_field_names = unsignedFieldNames.join(',');

        // Generate signature AFTER all fields are set
        params.signature = this.generateSignature(params, signedFieldNames);

        console.log(`${transactionType.toUpperCase()} payment request created successfully`);
        console.log('Signed fields:', params.signed_field_names);

        return params;
    }

    /**
     * Create authorization request (reserves funds only)
     */
    createAuthorizationRequest(paymentData: PaymentRequest): Record<string, string> {
        console.log('Creating AUTHORIZATION request - funds will be reserved only');
        return this.createPaymentRequest({
            ...paymentData,
            transactionType: 'authorization'
        });
    }

    /**
     * Create sale request (immediate capture - authorization + settlement)
     */
    createSaleRequest(paymentData: PaymentRequest): Record<string, string> {
        console.log('Creating SALE request - funds will be charged immediately');
        return this.createPaymentRequest({
            ...paymentData,
            transactionType: 'sale'
        });
    }

    /**
     * Get the appropriate endpoint URL
     */
    getEndpointUrl(): string {
        const url = this.isProduction ? this.productionEndpoint : this.testEndpoint;
        console.log('Using endpoint:', url);
        return url;
    }

    /**
     * Enhanced payment response processing with better error handling
     */
    processPaymentResponse(responseData: Record<string, string>): CybersourceResponse {
        console.log('Processing payment response:', responseData);

        // Check for error conditions first
        if (responseData.decision === 'ERROR') {
            console.error('Payment Error Details:', {
                decision: responseData.decision,
                reasonCode: responseData.reason_code,
                message: responseData.message,
                invalidFields: responseData.invalid_fields
            });

            // Handle specific error cases
            if (responseData.invalid_fields) {
                throw new BadRequestException(
                    `Invalid fields in payment request: ${responseData.invalid_fields}. ${responseData.message}`
                );
            }
        }

        // Verify signature only if not an error due to invalid fields
        if (responseData.decision !== 'ERROR' || !responseData.invalid_fields) {
            if (!this.verifySignature(responseData)) {
                console.error('Signature verification failed');
                throw new BadRequestException('Invalid response signature');
            }
        }

        const response: CybersourceResponse = {
            decision: responseData.decision,
            reasonCode: responseData.reason_code,
            transactionId: responseData.transaction_id,
            authCode: responseData.auth_code,
            authAmount: responseData.auth_amount,
            authTime: responseData.auth_time,
            message: responseData.message,
            invalidFields: responseData.invalid_fields,
            signature: responseData.signature,
            signedFieldNames: responseData.signed_field_names,
        };

        // Add any additional response fields
        Object.keys(responseData).forEach(key => {
            if (!response.hasOwnProperty(key.replace(/_/g, ''))) {
                response[key] = responseData[key];
            }
        });

        // Log different messages based on transaction type
        const transactionType = responseData.req_transaction_type;
        const logMessage = transactionType === 'sale'
            ? 'SALE payment processed (funds captured immediately)'
            : 'AUTHORIZATION payment processed (funds reserved)';

        console.log(logMessage, {
            decision: response.decision,
            transactionId: response.transactionId,
            reasonCode: response.reasonCode,
            transactionType: transactionType
        });

        return response;
    }

    /**
     * Simulate capture for demonstration purposes
     * In a real implementation, you would call Cybersource REST API for capture
     */
    async simulateCapture(captureRequest: CaptureRequest): Promise<any> {
        console.log('🚨 SIMULATED CAPTURE OPERATION 🚨');
        console.log('In a real implementation, this would call Cybersource REST API');
        console.log('Capture request:', captureRequest);

        // Simulate API response
        const captureResponse = {
            success: true,
            captureId: `CAPTURE_${Date.now()}`,
            status: 'CAPTURED',
            amount: captureRequest.amount,
            currency: captureRequest.currency,
            originalTransactionId: captureRequest.transactionId,
            capturedAt: new Date().toISOString(),
            message: 'Payment captured successfully'
        };

        console.log('Simulated capture response:', captureResponse);
        return captureResponse;
    }

    /**
     * Check if a transaction needs manual capture
     */
    needsCapture(responseData: Record<string, string>): boolean {
        return responseData.req_transaction_type === 'authorization' &&
            responseData.decision === 'ACCEPT';
    }

    /**
     * Check if a transaction was immediately settled
     */
    isImmediatelySettled(responseData: Record<string, string>): boolean {
        return responseData.req_transaction_type === 'sale' &&
            responseData.decision === 'ACCEPT';
    }

    /**
     * Get payment status description
     */
    getPaymentStatusDescription(responseData: Record<string, string>): string {
        const transactionType = responseData.req_transaction_type;
        const decision = responseData.decision;

        if (decision === 'ACCEPT') {
            if (transactionType === 'sale') {
                return 'Payment completed successfully - funds captured immediately';
            } else if (transactionType === 'authorization') {
                return 'Payment authorized successfully - funds reserved, capture required to complete payment';
            }
        } else if (decision === 'DECLINE') {
            return 'Payment declined - no funds reserved or captured';
        } else if (decision === 'REVIEW') {
            return 'Payment under review - manual verification required';
        } else if (decision === 'ERROR') {
            return 'Payment error - transaction failed due to invalid data or system error';
        }

        return `Payment status: ${decision}`;
    }

    /**
     * Create payment token request with enhanced timestamp handling
     */
    createTokenRequest(paymentData: PaymentRequest): Record<string, string> {
        const transactionUuid = this.generateUUID();
        const signedDateTime = this.getCurrentTimestamp();

        // Validate the generated timestamp
        if (!this.validateTimestamp(signedDateTime)) {
            throw new BadRequestException('Invalid timestamp generated');
        }

        const locale = paymentData.locale || 'en';

        const params: Record<string, string> = {
            access_key: this.accessKey,
            profile_id: this.profileId,
            transaction_uuid: transactionUuid,
            signed_date_time: signedDateTime,
            locale: locale,
            transaction_type: 'create_payment_token',
            reference_number: paymentData.referenceNumber,
            amount: paymentData.amount,
            currency: paymentData.currency,
            payment_method: 'card',
            bill_to_forename: paymentData.billToForename,
            bill_to_surname: paymentData.billToSurname,
            bill_to_email: paymentData.billToEmail,
            bill_to_address_line1: paymentData.billToAddressLine1,
            bill_to_address_city: paymentData.billToAddressCity,
            bill_to_address_state: paymentData.billToAddressState,
            bill_to_address_country: paymentData.billToAddressCountry,
            bill_to_address_postal_code: paymentData.billToAddressPostalCode,
        };

        const signedFieldNames = [
            'access_key',
            'profile_id',
            'transaction_uuid',
            'signed_date_time',
            'locale',
            'transaction_type',
            'reference_number',
            'amount',
            'currency',
            'payment_method',
            'bill_to_forename',
            'bill_to_surname',
            'bill_to_email',
            'bill_to_address_line1',
            'bill_to_address_city',
            'bill_to_address_state',
            'bill_to_address_country',
            'bill_to_address_postal_code',
            'signed_field_names',
            'unsigned_field_names'
        ];

        const unsignedFieldNames = [
            'card_type',
            'card_number',
            'card_expiry_date',
            'card_cvn'
        ];

        params.signed_field_names = signedFieldNames.join(',');
        params.unsigned_field_names = unsignedFieldNames.join(',');
        params.signature = this.generateSignature(params, signedFieldNames);

        console.log('Token request created successfully');
        return params;
    }

    /**
     * Process payment with existing token with enhanced timestamp handling
     */
    createTokenPaymentRequest(
        paymentToken: string,
        amount: string,
        currency: string,
        referenceNumber: string,
        transactionType: 'authorization' | 'sale' = 'sale' // Default to sale for immediate capture
    ): Record<string, string> {
        const transactionUuid = this.generateUUID();
        const signedDateTime = this.getCurrentTimestamp();

        // Validate the generated timestamp
        if (!this.validateTimestamp(signedDateTime)) {
            throw new BadRequestException('Invalid timestamp generated');
        }

        console.log(`Creating token ${transactionType} request for amount: ${amount}`);

        const params: Record<string, string> = {
            access_key: this.accessKey,
            profile_id: this.profileId,
            transaction_uuid: transactionUuid,
            signed_date_time: signedDateTime,
            locale: 'en',
            transaction_type: transactionType,
            reference_number: referenceNumber,
            amount: amount,
            currency: currency,
            payment_method: 'card',
            payment_token: paymentToken,
        };

        const signedFieldNames = [
            'access_key',
            'profile_id',
            'transaction_uuid',
            'signed_date_time',
            'locale',
            'transaction_type',
            'reference_number',
            'amount',
            'currency',
            'payment_method',
            'payment_token',
            'signed_field_names',
            'unsigned_field_names'
        ];

        params.signed_field_names = signedFieldNames.join(',');
        params.unsigned_field_names = '';
        params.signature = this.generateSignature(params, signedFieldNames);

        console.log(`Token ${transactionType} request created successfully`);
        return params;
    }
}