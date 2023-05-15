import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/queryhistoricalfunctions/:myaccount')
  @ApiOperation({
    summary: 'Queriy historical functions from Polybase',
    description: 'A user queries all his/her historical functions',
  })
  @ApiParam({
    name: 'myaccount',
    type: String,
    description: "Current user's account address",
    example: '0x0160ceDB6cae2EAd33F5c2fa25FE078485a07b63',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Sucessfully query historical offer data from Polybase',
  })
  @ApiResponse({
    status: 400,
    description: 'no index found matching the query',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async queryHistoricalfunctions(@Param('myaccount') myaccount: string) {
    const historicalfunctions = await this.appService.searchHistoricalfunctions(
      myaccount,
    );
    return historicalfunctions;
  }
}
