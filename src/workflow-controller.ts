import { Saga } from "./package/saga";
import {
  userStep,
  paymentStep,
  profileUpdateStep,
  auditLogStep,
} from "./steps-typed";

export class BasicSaga {
  private saga: Saga;

  constructor() {
    this.saga = new Saga();
  }

  // async runBasicSaga() {
  //   console.log("Running basic saga");
  //   this.saga.addStep(stepA).addStep(stepB).addStep(stepC);
  //   await this.runSaga();
  // }

  // async runAdditionSaga() {
  //   console.log("\nRunning addition saga");
  //   this.saga.addStep(stepX);
  //   await this.runSaga();
  // }

  // async runRemovingStepSaga() {
  //   console.log("\nRunning with removed step saga - remove B");
  //   this.saga.removeStep("B");
  //   await this.runSaga();
  // }

  // async runParallelSaga() {
  //   console.log("\nRunning parallel saga");
  //   this.saga.addStep([stepParallel1, stepParallel2]);
  //   await this.runSaga();
  // }

  // private addLastCompensate() {
  //   this.saga.addGlobalCompensate(async (context) => {
  //     console.log("Last compensate");
  //   });
  // }

  // async runParallelSagaWithError() {
  //   console.log("\nRunning parallel saga with error");
  //   this.addLastCompensate();
  //   this.saga
  //     .addStep(stepA)
  //     .addStep(stepB)
  //     .addStep(stepC)
  //     .addStep(stepX)
  //     .addStep([stepParallel1, stepParallel2])
  //     .addStep(stepFail);
  //   await this.runSaga();
  // }

  async runSaga() {
    try {
      this.saga
        .addStep(userStep)
        .addStep(paymentStep)
        .addStep(profileUpdateStep)
        .addStep(auditLogStep);
      const context = await this.saga.execute({ userId: 789 });
      console.log("Final context:", context);

      // this.saga.addStep(userStep).addStep(paymentStep).addStep(profileUpdateStep).addStep(auditLogStep);
      // const context1 = await this.saga.execute({ userId: 666 });
      // console.log("Final context:", context1);
      // const context = await this.saga.execute({ userId: 789 });
      // console.log("Final context:", context);
    } catch (err: any) {
      console.error("Saga failed:", err.message);
    }
  }
}
