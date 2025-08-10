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

  async runSaga() {
    try {
      this.saga
        .addStep(userStep)
        .addStep(paymentStep)
        .addStep(profileUpdateStep)
        .addStep(auditLogStep);
      const context = await this.saga.execute({ userId: 789 });
      console.log("Final context:", context);
    } catch (err: any) {
      console.error("Saga failed:", err.message);
    }
  }

  async runSagaWithSkip() {
    this.saga
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep)
      .skipStep("processPayment");
    const context = await this.saga.execute({ userId: 789 });
    console.log("Final context:", context);
  }

  async runSagaWithRetry() {
    this.saga
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep)
      .setStepReruns("auditLog", 4);
    const context = await this.saga.execute({ userId: 789 });
    console.log("Final context:", context);
  }

  async runWithGlobalCompensate() {
    this.saga
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep)
      .addGlobalCompensate(async (context) => {
        console.log("Compensating for all steps");
      });
    const context = await this.saga.execute({ userId: 789 });
    console.log("Final context:", context);
  }
}
