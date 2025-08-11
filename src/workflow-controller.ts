import { Saga, WorkflowManager } from "./package/saga";
import {
  userStep,
  paymentStep,
  profileUpdateStep,
  auditLogStep,
} from "./steps-typed";

export class BasicSaga {
  private saga: Saga;
  private workflowManager: WorkflowManager;

  constructor() {
    this.saga = new Saga();
    this.workflowManager = new WorkflowManager();
    this.setupNamedWorkflows();
  }

  private setupNamedWorkflows() {
    // Register different workflow variations
    const userOnboardingWorkflow = new Saga()
      .setWorkflowName("user-onboarding")
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep);

    const userOnboardingWithRetryWorkflow = new Saga()
      .setWorkflowName("user-onboarding-with-retry")
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep)
      .setStepReruns("auditLog", 4);

    const userOnboardingSkipPaymentWorkflow = new Saga()
      .setWorkflowName("user-onboarding-skip-payment")
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep)
      .skipStep("processPayment");

    const userOnboardingWithGlobalCompensateWorkflow = new Saga()
      .setWorkflowName("user-onboarding-with-global-compensate")
      .addStep(userStep)
      .addStep(paymentStep)
      .addStep(profileUpdateStep)
      .addStep(auditLogStep)
      .addGlobalCompensate(async (context) => {
        console.log("Global compensation: Cleaning up resources for user", context.userId);
      });

    // Register all workflows
    this.workflowManager
      .registerWorkflow("user-onboarding", userOnboardingWorkflow)
      .registerWorkflow("user-onboarding-with-retry", userOnboardingWithRetryWorkflow)
      .registerWorkflow("user-onboarding-skip-payment", userOnboardingSkipPaymentWorkflow)
      .registerWorkflow("user-onboarding-with-global-compensate", userOnboardingWithGlobalCompensateWorkflow);
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

  // New methods using the WorkflowManager

  async runNamedWorkflow(workflowName: string, userId: number = 789) {
    try {
      console.log(`\n=== Running Named Workflow: ${workflowName} ===`);
      const result = await this.workflowManager.runWorkflow(workflowName, { userId });
      console.log(`Workflow ${workflowName} completed successfully!`);
      console.log("Final context:", result.finalContext);
      console.log("Run ID:", result.runId);
      return result;
    } catch (err: any) {
      console.error(`Named workflow ${workflowName} failed:`, err.message);
      throw err;
    }
  }

  async rerunWorkflow(workflowName: string, userId: number = 890) {
    try {
      console.log(`\n=== Rerunning Workflow: ${workflowName} with different context ===`);
      const result = await this.workflowManager.runWorkflow(workflowName, { userId, isRerun: true });
      console.log(`Workflow ${workflowName} rerun completed successfully!`);
      console.log("Final context:", result.finalContext);
      console.log("Run ID:", result.runId);
      return result;
    } catch (err: any) {
      console.error(`Workflow rerun ${workflowName} failed:`, err.message);
      throw err;
    }
  }

  listAllWorkflows() {
    console.log("\n=== Available Workflows ===");
    const workflows = this.workflowManager.listWorkflows();
    workflows.forEach(name => {
      const stats = this.workflowManager.getWorkflowStats(name);
      console.log(`- ${name} (executions: ${stats?.totalExecutions || 0}, success: ${stats?.successfulExecutions || 0})`);
    });
    return workflows;
  }

  getWorkflowHistory(workflowName: string) {
    console.log(`\n=== Execution History for ${workflowName} ===`);
    const history = this.workflowManager.getWorkflowHistory(workflowName);
    history.forEach((execution, index) => {
      console.log(`${index + 1}. ${execution.success ? '✅' : '❌'} ${execution.runId} at ${execution.executedAt.toISOString()}`);
      if (!execution.success && execution.error) {
        console.log(`   Error: ${execution.error.message}`);
      }
    });
    return history;
  }

  async demonstrateWorkflowReuse() {
    console.log("\n=== Demonstrating Workflow Reuse ===");
    
    // Run the same workflow multiple times with different contexts
    await this.runNamedWorkflow("user-onboarding", 100);
    await this.runNamedWorkflow("user-onboarding", 200);
    await this.rerunWorkflow("user-onboarding", 300);
    
    // Show execution history
    this.getWorkflowHistory("user-onboarding");
    
    // List all workflows and their stats
    this.listAllWorkflows();
  }
}
