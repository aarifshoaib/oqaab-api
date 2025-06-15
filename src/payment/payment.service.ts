import { Injectable } from '@nestjs/common';
import * as cybersourceRestApi from 'cybersource-rest-client';

@Injectable()
export class PaymentService {
    private getConfig() {
        return {
            authenticationType: 'http_signature',
            runEnvironment: 'apitest.cybersource.com',
            merchantID: 'cyboqaabgene_1748680837',
            merchantKeyId: '91be7723-dbc6-4a3e-b8b0-1492c71887fd',
            merchantsecretKey: '3DCV/pjGfYhpNCxTvcdJjbMnccJXDVYuiBlhWg+hSLM=',
            // runEnvironment: 'api.cybersource.com',
            // merchantID: 'cyboqaabgene',
            // merchantKeyId: '9e12ddde-ded7-45ad-b937-d2de4725f6be',
            // merchantsecretKey: 'ikzOCo0qhXMIUqcgfwQz/Q9J+DO4TAkMFXrPMUapJCw=',
            logConfiguration: {
                enableLog: true,
                logFileName: 'cybs',
                logDirectory: 'log',
                logFileMaxSize: '5242880', // in bytes (5 MB)
                loggingLevel: 'debug',
                enableMasking: true,
            },
        };
    }


    async getCaptureContext() {
        const configObject = this.getConfig();
        const apiClient = new cybersourceRestApi.ApiClient();
        const requestObj = new cybersourceRestApi.GenerateCaptureContextRequest();

        requestObj.clientVersion = 'v2';
        requestObj.targetOrigins = ['http://localhost:5173', 'https://oqaabfashions.com', 'https://www.oqaabfashions.com', 'https://uat.oqaabfashions.com'];
        requestObj.allowedCardNetworks = ['VISA', 'MASTERCARD','AMEX'];
        requestObj.allowedPaymentTypes = ['CARD'];

        const instance = new cybersourceRestApi.MicroformIntegrationApi(configObject, apiClient);
        console.log('\nRequest Object : ' + JSON.stringify(requestObj));
        return new Promise((resolve, reject) => {
            instance.generateCaptureContext(requestObj, (err, data, response) => {
                if (err) reject(err);
                else {
                    console.log('\nResponse : ' + JSON.stringify(response));
                    console.log('\nResponse Code of Process a Capture : ' + JSON.stringify(response['status']));
                    resolve({ captureContext: data });
                }
            });
        });
    }

    async makePayment(payload: any) {
        console.log('Payload for makePayment:', payload);
        const configObject = this.getConfig();
        const apiClient = new cybersourceRestApi.ApiClient();
        const instance = new cybersourceRestApi.PaymentsApi(configObject);
        const requestObj = new cybersourceRestApi.CreatePaymentRequest();

        // Client Reference
        const clientReference = new cybersourceRestApi.Ptsv2paymentsClientReferenceInformation();
        clientReference.code = 'TC50171_3';
        requestObj.clientReferenceInformation = clientReference;

        // Processing Info
        const processingInfo = new cybersourceRestApi.Ptsv2paymentsProcessingInformation();
        processingInfo.capture = false;
        processingInfo.actionList = ['TOKEN_CREATE'];
        processingInfo.actionTokenTypes = ['customer', 'paymentInstrument', 'shippingAddress'];
        requestObj.processingInformation = processingInfo;

        // Payment Info
        const card = new cybersourceRestApi.Ptsv2paymentsPaymentInformationCard();
        card.number = payload.cardNumber;
        card.expirationMonth = payload.expirationMonth;
        card.expirationYear = payload.expirationYear;
        card.securityCode = payload.securityCode;

        const paymentInfo = new cybersourceRestApi.Ptsv2paymentsPaymentInformation();
        paymentInfo.card = card;
        requestObj.paymentInformation = paymentInfo;

        // Amount + Billing
        const amountDetails = new cybersourceRestApi.Ptsv2paymentsOrderInformationAmountDetails();
        amountDetails.totalAmount = payload.totalPrice;
        amountDetails.currency = 'AED';

        const billTo = new cybersourceRestApi.Ptsv2paymentsOrderInformationBillTo();
        billTo.firstName = payload.shippingInfo.name;
        billTo.lastName = payload.shippingInfo.lname;
        billTo.address1 = payload.shippingInfo.flat_no || payload.shippingInfo.building_name || payload.shippingInfo.area || payload.shippingInfo.street;
        billTo.locality = payload.shippingInfo.emirate;
        billTo.administrativeArea = payload.shippingInfo.emirate;
        billTo.postalCode = payload.shippingInfo.postalCode;
        billTo.country = 'AE';
        billTo.email = payload.shippingInfo.email;
        billTo.phoneNumber = payload.shippingInfo.phone;

        const shipTo = new cybersourceRestApi.Ptsv2paymentsOrderInformationShipTo();
        Object.assign(shipTo, billTo);

        const orderInfo = new cybersourceRestApi.Ptsv2paymentsOrderInformation();
        orderInfo.amountDetails = amountDetails;
        orderInfo.billTo = billTo;
        orderInfo.shipTo = shipTo;

        const lineItems = [];
        if (payload.cartProducts && Array.isArray(payload.cartProducts)) {
            payload.cartProducts.forEach((product, index) => {
                const lineItem = new cybersourceRestApi.Ptsv2paymentsOrderInformationLineItems();
                lineItem.productCode = 'default';
                lineItem.quantity = parseInt(product.quantity)
                lineItem.unitPrice = parseFloat(product.price.toString());
                lineItem.productName = 'shipping_only';
                // lineItem.productSku = 'shipping_only';
                // lineItem.productDescription = 'Product description for ' + product.title;
                // lineItem.taxAmount = (product.tax || 0).toString();
                // lineItem.discountAmount = (product.discount || 0).toString();
                lineItem.lineItemId = parseInt(index.toString());
                lineItems.push(lineItem);
            });
        }



        //orderInfo.lineItems = lineItems;

        requestObj.orderInformation = orderInfo;

        requestObj.tokenInformation = { transientTokenJwt: payload.token };

        console.log('\nRequest Object : ' + JSON.stringify(requestObj));

        const paymentsInstance = new cybersourceRestApi.PaymentsApi(configObject, apiClient);
        const captureInstance = new cybersourceRestApi.CaptureApi(configObject, apiClient);

        return new Promise((resolve, reject) => {
            paymentsInstance.createPayment(requestObj, async (error, data, response) => {
                if (error) {
                    return reject(error);
                }
                console.log('Response', data);
                if (!data || data.status == '400') {
                    return resolve({
                        authorization: data,
                        capture: null,
                        message: 'Authorization failed or was declined, skipping capture.'
                    });
                }

                try {
                    const paymentId = data.id;
                    const authorizationCode = data.processorInformation?.approvalCode;

                    if (!authorizationCode) {
                        return reject(new Error('Authorization code missing for capture.'));
                    }

                    const captureRequest = new cybersourceRestApi.CapturePaymentRequest();
                    captureRequest.clientReferenceInformation = clientReference;

                    const captureAmountDetails = new cybersourceRestApi.Ptsv2paymentsidcapturesOrderInformationAmountDetails();
                    captureAmountDetails.totalAmount = payload.amount;
                    captureAmountDetails.currency = payload.currency;

                    const captureOrderInfo = new cybersourceRestApi.Ptsv2paymentsidcapturesOrderInformation();
                    captureOrderInfo.amountDetails = captureAmountDetails;
                    captureRequest.orderInformation = captureOrderInfo;

                    const capturePaymentInfo = new cybersourceRestApi.Ptsv2paymentsidcapturesPaymentInformation();
                    
                    capturePaymentInfo.authorizationOptions = {
                        authorizationCode: authorizationCode
                    };

                    captureRequest.paymentInformation = capturePaymentInfo;

                    // Execute Capture changed by AS. for automatic capture
                    captureInstance.capturePayment(captureRequest, paymentId, (captureError, captureData, captureResponse) => {
                        if (captureError) {
                            return reject(captureError);
                        }
                        return resolve({
                            authorization: data,
                            capture: captureData,
                        });
                    });

                } catch (captureException) {
                    return reject(captureException);
                }
            });
        });



        // request.orderInformation = {
        //     amountDetails: { totalAmount: '25.00', currency: 'AED' },
        //     billTo: {
        //         firstName: 'Arif', lastName: 'Safiyullah', address1: 'Al Hisn St',
        //         locality: 'Abu Dhabi', administrativeArea: 'AD', postalCode: '00000',
        //         country: 'AE', email: 'arif.safiyullah@adports.ae'
        //     }
        // };

        // return new Promise((resolve, reject) => {
        //     instance.createPayment(requestObj, async (error, data, response) => {
        //         console.log('\nResponse : ' + JSON.stringify(data));
        //         console.log('\nResponse Code of Process a Payment : ' + JSON.stringify(data['status']));
        //         if (error) reject(error);
        //         else resolve(data);
        //     });
        // });
    }
}
