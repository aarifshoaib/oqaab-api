import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('capture')
    async getCaptureContext() {
        return await this.paymentService.getCaptureContext();
    }

    @Post('pay')
    makePayment(@Body() body: any) {
        return this.paymentService.makePayment(body);
    }
}
