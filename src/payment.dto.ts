export class CreatePaymentDto {
    amount: string;
    currency: string;
    cardNumber: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;

    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    email: string;
    phone: string;
}
  