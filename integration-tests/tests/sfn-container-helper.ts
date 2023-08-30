import {
  CreateStateMachineCommand,
  DescribeStateMachineCommand,
  DescribeStateMachineCommandOutput,
  ExecutionDoesNotExist,
  GetExecutionHistoryCommand,
  GetExecutionHistoryCommandOutput,
  HistoryEvent,
  SFNClient,
  StartExecutionCommand,
  StartExecutionCommandOutput,
} from "@aws-sdk/client-sfn";
import { StartedTestContainer, GenericContainer } from "testcontainers";
import fs from "fs";
import path from "path";
import { StepFunctionConstants } from "./step-functions-constants";

const MAX_RETRIES = 10;

export class SfnContainerHelper {
  private sfnClient: Promise<SFNClient>;
  private composeEnvironment: Promise<StartedTestContainer>;

  public constructor(
    private readonly mockContent?: string,
    private tempFilePath?: string
  ) {
    this.composeEnvironment = Promise.resolve(this.createTestContainer());
    this.sfnClient = Promise.resolve(this.createSfnClient());
  }

  public getContainer = async () => {
    const container = await this.composeEnvironment;
    if (this.mockContent) {
      this.tempFilePath = this.getFileForPartialMock();
      await this.copyFileToContainer(container, this.tempFilePath);
    } else {
      await this.copyFileToContainer(container);
    }
    // (await container.logs())
    // .on("data", line => console.log(line))
    // .on("err", line => console.error(line))
    // .on("end", () => console.log("Stream closed"));
    return container;
  };

  getFileForPartialMock = () => {
    if (!this.mockContent)
      throw Error("MockContent not supplied for partial mockconfigfile");

    this.tempFilePath = path.join(__dirname, "tempFile.json");
    fs.writeFileSync(this.tempFilePath, this.mockContent, "utf-8");
    return this.tempFilePath;
  };

  private releasePartialMockConfigfile() {
    if (this.tempFilePath) {
      fs.unlinkSync(this.tempFilePath);
    }
  }

  private async copyFileToContainer(
    container: StartedTestContainer,
    source?: string
  ) {
    const copyConfig = [
      {
        source: source || StepFunctionConstants.mockFileHostPath,
        target: StepFunctionConstants.mockFileContainerPath,
        mode: parseInt("0644", 8),
      },
    ];
    await container.copyFilesToContainer(copyConfig);
  }
  public shutDown = async () => {
    await (await this.composeEnvironment)?.stop();
    this.releasePartialMockConfigfile();
  };

  public startStepFunctionExecution = async (
    testName: string,
    stepFunctionInput: string,
    inputStateMachineArn?: string
  ): Promise<StartExecutionCommandOutput> => {
    const stateMachineArn =
      inputStateMachineArn ||
      `${
        (await this.createStateMachine()).stateMachineArn as string
      }#${testName}`;
    return await (
      await this.sfnClient
    ).send(
      new StartExecutionCommand({
        stateMachineArn,
        input: stepFunctionInput,
      })
    );
  };
  public waitFor = async (
    criteria: (event: HistoryEvent) => boolean,
    executionResponse: StartExecutionCommandOutput
  ): Promise<HistoryEvent[]> => {
    const executionHistoryResult = await this.untilExecutionCompletes(
      executionResponse
    );
    return executionHistoryResult?.events?.filter(criteria) as HistoryEvent[];
  };
  sleep = (milliseconds: number) =>
    Promise.resolve((resolve: (arg: string) => unknown) =>
      setTimeout(() => {
        resolve(""), milliseconds;
      })
    );

  createSfnClient = async (): Promise<SFNClient> => {
    const container = await this.getContainer();
    return new SFNClient({
      endpoint: `http://${container.getHost()}:${container.getMappedPort(
        8083
      )}`,
      credentials: {
        accessKeyId:
          process.env.AWS_ACCESS_KEY_ID ||
          StepFunctionConstants.AWS_ACCESS_KEY_ID,
        secretAccessKey:
          process.env.AWS_SECRET_ACCESS_KEY ||
          StepFunctionConstants.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN || "local",
      },
      region:
        process.env.AWS_DEFAULT_REGION ||
        StepFunctionConstants.AWS_DEFAULT_REGION,
    });
  };

  createTestContainer = async (): Promise<StartedTestContainer> => {
    const container = await new GenericContainer(
      "amazon/aws-stepfunctions-local"
    )
      .withEnvironment({
        AWS_SECRET_ACCESS_KEY:
          process.env.AWS_SECRET_ACCESS_KEY ||
          StepFunctionConstants.AWS_ACCESS_KEY_ID,
        SFN_MOCK_CONFIG:
          process.env.SFN_MOCK_CONFIG ||
          StepFunctionConstants.mockFileContainerPath,
        AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || "local",
        AWS_ACCESS_KEY_ID:
          process.env.AWS_ACCESS_KEY_ID ||
          StepFunctionConstants.AWS_ACCESS_KEY_ID,
        AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN || "local",
      })
      .withExposedPorts(8083)
      .withStartupTimeout(10_000)
      .start();

    this.sleep(10_000);
    return container;
  };
  createStateMachine = async (stepFunctionDefinition?: string) => {
    const createStateMachineResponse = await (
      await this.sfnClient
    ).send(
      new CreateStateMachineCommand({
        name: StepFunctionConstants.STATE_MACHINE_NAME,
        definition:
          stepFunctionDefinition || StepFunctionConstants.STATE_MACHINE_ASL,
        roleArn:
          process.env.STATE_MACHINE_ROLE || StepFunctionConstants.DUMMY_ROLE,
      })
    );
    return createStateMachineResponse;
  };

  untilExecutionCompletes = async (
    executionResponse: StartExecutionCommandOutput,
    retries = MAX_RETRIES
  ): Promise<GetExecutionHistoryCommandOutput> => {
    try {
      const historyResponse = await this.getExecutionHistory(
        executionResponse.executionArn
      );
      if (this.executionState(historyResponse, "ExecutionSucceeded")) {
        return historyResponse;
      }
      if (retries > 0) {
        await this.sleep(1_000);
        return this.untilExecutionCompletes(executionResponse, retries - 1);
      }
      throw new Error(`Execution did not complete successfully`);
    } catch (error: unknown) {
      if (
        error instanceof ExecutionDoesNotExist &&
        error.name === "ExecutionDoesNotExist" &&
        retries > 0
      ) {
        await this.sleep(1_000);
        return this.untilExecutionCompletes(executionResponse, retries - 1);
      } else {
        await this.sleep(1_000);
        return this.untilExecutionCompletes(executionResponse, retries - 1);
      }
    }
  };
  getExecutionHistory = async (
    executionArn?: string
  ): Promise<GetExecutionHistoryCommandOutput> => {
    return await (
      await this.sfnClient
    ).send(
      new GetExecutionHistoryCommand({
        executionArn,
      })
    );
  };
  executionState = (
    history: GetExecutionHistoryCommandOutput,
    state: string
  ): boolean => {
    return (
      history?.events?.filter((event) => event.type === state).length === 1
    );
  };
  describeStepFunction =
    async (): Promise<DescribeStateMachineCommandOutput> => {
      const sfnClient = new SFNClient({
        region:
          process.env.AWS_DEFAULT_REGION ||
          StepFunctionConstants.AWS_DEFAULT_REGION,
      });

      return await sfnClient.send(
        new DescribeStateMachineCommand({
          stateMachineArn:
            process.env.STATE_MACHINE_ARN ||
            ((
              await this.createStateMachine()
            ).stateMachineArn as string),
        })
      );
    };
}
