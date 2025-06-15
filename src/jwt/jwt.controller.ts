import { Controller, Post, Body } from '@nestjs/common';
import { JwtService } from './jwt.service';

@Controller('generate-jwt')
export class JwtController {
    constructor(private readonly jwtService: JwtService) { }

    @Post()
    generate(@Body() payload: any) {
        const token = this.jwtService.generateJWT(payload);
        return { token };
    }
}
