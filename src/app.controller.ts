import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ExecuteService } from './execute/execute.service';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CostEstimateDto } from 'dtos/estimate.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly executeService: ExecuteService) {}

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

  @Post('/estimatecost')
  @ApiOperation({
    summary: 'Get estimated function execution cost in USD',
    description: 'Get estimated function execution cost in USD',
  })
  @ApiResponse({
    status: 201,
    description: 'Sucessfully get estimation fees from consumer contract',
  })
  @ApiResponse({
    status: 400,
    description: 'no estimation fees found matching the query',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  // passing secrets is insecure
  async estimationCost(@Body() costEstimateDto: CostEstimateDto): Promise<number> {
    const estimatedCost = await this.appService.estimateCost(
      costEstimateDto.source,
      costEstimateDto.args,
      costEstimateDto.secrets
    );
    return estimatedCost;
  }

  @Post('/executerequest')
  @ApiOperation({
    summary: 'Request to execute function with provided parameters',
    description: 'Request to execute function with provided parameters and return execution results',
  })
  @ApiResponse({
    status: 201,
    description: 'Sucessfully executed function and get results',
  })
  @ApiResponse({
    status: 400,
    description: 'no execution function found matching the query',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async executeRequest(@Body() executeRequestDto: CostEstimateDto): Promise<String> {
    const response = await this.executeService.executeRequest(
      executeRequestDto.source,
      executeRequestDto.args,
      executeRequestDto.secrets
    );
    return response;
  }
}
