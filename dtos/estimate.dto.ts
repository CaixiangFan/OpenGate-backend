import { ApiProperty } from "@nestjs/swagger";

export class CostEstimateDto {
  @ApiProperty({
    required: true,
    description: "Source code string to be executed",
    example: 'console.log("Hello world!")',
  })
  source: string;

  @ApiProperty({
    required: true,
    description: "Arguments for executing the source code",
    example: '["1", "bitcoin", "btc-bitcoin", "btc", "1000000", "450"]',
  })
  args: [string];

  @ApiProperty({
    required: false,
    description: "Secrets to execute source code, e.g., apiKey",
    example: '{ apiKey: "HDsofnsofnwofenwejf2840250mvsd" }',
  })
  secrets: Object;
}