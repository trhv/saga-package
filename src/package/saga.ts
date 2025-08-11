type SagaContext = Record<string, any>;

export type Step<TInput = SagaContext, TOutput = SagaContext> = {
  name: string;
  action: (context: TInput) => Promise<Partial<TOutput> | void>;
  compensate: (context: TInput) => Promise<void>;
  skip?: boolean;
  maxReruns?: number;
};

// Helper type for creating strongly typed steps
export type TypedStep<TInput, TOutput> = Step<TInput, TOutput>;

// Helper functions for creating typed steps
export function createStep<TInput = SagaContext, TOutput = SagaContext>(
  step: Step<TInput, TOutput>
): Step<TInput, TOutput> {
  return step;
}

export function createTypedStep<TInput, TOutput>(
  step: Step<TInput, TOutput>
): Step<TInput, TOutput> {
  return step;
}

// Allow a "Step" or "Step[]" with any context types
export type SagaStep = Step<any, any> | Step<any, any>[];

// Export the WorkflowManager from the same module for convenience
export { WorkflowManager, type WorkflowDefinition, type WorkflowExecutionResult } from './workflow-manager';

type StepExecution = {
  step: SagaStep;
  context: any | any[]; // Array for parallel steps, single for sequential
};

export class Saga {
  private steps: SagaStep[] = [];
  private completedSteps: StepExecution[] = [];
  private context: any = {};
  private lastCompensate: ((context: any) => Promise<void>) | undefined;
  private runId: string = "";
  private workflowName: string = "";

  private async executeStepWithRetry(
    step: Step<any, any>,
    stepContext: any,
    maxReruns: number = 0
  ): Promise<any> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= maxReruns) {
      try {
        const workflowDisplay = this.workflowName ? `${this.workflowName} (${this.runId})` : this.runId;
        if (attempt > 0) {
          console.log(`[Saga ${workflowDisplay}] Retrying step: ${step.name} (attempt ${attempt + 1}/${maxReruns + 1})`);
        }
        const result = await step.action(stepContext);
        if (attempt > 0) {
          console.log(`[Saga ${workflowDisplay}] Step ${step.name} succeeded on retry attempt ${attempt + 1}`);
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        const workflowDisplay = this.workflowName ? `${this.workflowName} (${this.runId})` : this.runId;
        console.log(`[Saga ${workflowDisplay}] Step ${step.name} failed on attempt ${attempt + 1}: ${lastError.message}`);
        attempt++;
      }
    }

    const workflowDisplay = this.workflowName ? `${this.workflowName} (${this.runId})` : this.runId;
    console.log(`[Saga ${workflowDisplay}] Step ${step.name} failed after ${maxReruns + 1} attempts`);
    throw lastError;
  }

  addStep(step: SagaStep): Saga {
    this.steps.push(step);
    return this;
  }

  removeStep(stepName: string): Saga {
    this.steps = this.steps
      .map((step) => {
        if (Array.isArray(step)) {
          // Filter out the named step from the group
          const filtered = step.filter((s) => s.name !== stepName);
          return filtered.length === 0 ? null : filtered;
        } else {
          // Remove if name matches
          return step.name === stepName ? null : step;
        }
      })
      .filter(Boolean) as SagaStep[];
    return this;
  }

  addGlobalCompensate(compensate: (context: any) => Promise<void>): Saga {
    this.lastCompensate = compensate;
    return this;
  }

  insertStepAt(step: SagaStep, index: number): Saga {
    this.steps.splice(index, 0, step);
    return this;
  }

  getRunId(): string {
    return this.runId;
  }

  setWorkflowName(name: string): Saga {
    this.workflowName = name;
    return this;
  }

  getWorkflowName(): string {
    return this.workflowName;
  }

  // Clone the saga for rerunning - creates a new instance with same steps and configuration
  clone(): Saga {
    const clonedSaga = new Saga();
    clonedSaga.steps = [...this.steps]; // Shallow copy of steps array
    clonedSaga.workflowName = this.workflowName;
    clonedSaga.lastCompensate = this.lastCompensate;
    return clonedSaga;
  }

  // Reset the saga state for rerunning (clears execution state but keeps configuration)
  reset(): Saga {
    this.completedSteps = [];
    this.context = {};
    this.runId = "";
    return this;
  }

  getStepReruns(stepName: string): number | undefined {
    for (const step of this.steps) {
      if (Array.isArray(step)) {
        const foundStep = step.find(s => s.name === stepName);
        if (foundStep) {
          return foundStep.maxReruns;
        }
      } else {
        if (step.name === stepName) {
          return step.maxReruns;
        }
      }
    }
    return undefined;
  }

  setStepReruns(stepName: string, maxReruns: number): Saga {
    this.steps.forEach((step) => {
      if (Array.isArray(step)) {
        step.forEach((s) => {
          if (s.name === stepName) {
            s.maxReruns = maxReruns;
          }
        });
      } else {
        if (step.name === stepName) {
          step.maxReruns = maxReruns;
        }
      }
    });
    return this;
  }

  skipStep(stepName: string): Saga {
    this.steps.forEach((step) => {
      if (Array.isArray(step)) {
        step.forEach((s) => {
          if (s.name === stepName) {
            s.skip = true;
          }
        });
      } else {
        if (step.name === stepName) {
          step.skip = true;
        }
      }
    });
    return this;
  }

  unskipStep(stepName: string): Saga {
    this.steps.forEach((step) => {
      if (Array.isArray(step)) {
        step.forEach((s) => {
          if (s.name === stepName) {
            s.skip = false;
          }
        });
      } else {
        if (step.name === stepName) {
          step.skip = false;
        }
      }
    });
    return this;
  }

  async execute(initialContext: any = {}): Promise<any> {
    // Generate a new GUID for this run
    this.runId = crypto.randomUUID();
    const workflowDisplay = this.workflowName ? `${this.workflowName} (${this.runId})` : this.runId;
    console.log(`[Saga ${workflowDisplay}] Starting saga execution`);
    
    this.context = { ...initialContext };
    for (const step of this.steps) {
      // Create a separate context for this step (copy of current global context)
      const stepContext = { ...this.context };
      const workflowDisplay = this.workflowName ? `${this.workflowName} (${this.runId})` : this.runId;
      
      try {
        if (Array.isArray(step)) {
          // Parallel execution - filter out skipped steps
          const activeSteps = step.filter(s => !s.skip);
          
          if (activeSteps.length === 0) {
            const stepNames = step.map(s => s.name).join(', ');
            console.log(`[Saga ${workflowDisplay}] Skipping all parallel steps: ${stepNames}`);
            continue;
          }
          
          const activeStepNames = activeSteps.map(s => s.name).join(', ');
          const skippedStepNames = step.filter(s => s.skip).map(s => s.name);
          
          if (skippedStepNames.length > 0) {
            console.log(`[Saga ${workflowDisplay}] Skipping parallel steps: ${skippedStepNames.join(', ')}`);
          }
          console.log(`[Saga ${workflowDisplay}] Executing parallel steps: ${activeStepNames}`);
          
          const stepContexts = activeSteps.map(() => ({ ...this.context }));
          const results = await Promise.all(
            activeSteps.map((s, index) => {
              console.log(`[Saga ${workflowDisplay}] Running step: ${s.name}`);
              return this.executeStepWithRetry(s, stepContexts[index], s.maxReruns || 0);
            })
          );
          
          // Merge all results into global context
          results.forEach((result) => {
            if (result && typeof result === "object")
              Object.assign(this.context, result);
          });
          
          // Store step execution with contexts - only for executed steps
          if (activeSteps.length > 0) {
            this.completedSteps.push({ step: activeSteps, context: stepContexts });
          }
        } else {
          // Sequential execution - check if step should be skipped
          if (step.skip) {
            console.log(`[Saga ${workflowDisplay}] Skipping step: ${step.name}`);
            continue;
          }
          
          console.log(`[Saga ${workflowDisplay}] Running step: ${step.name}`);
          const result = await this.executeStepWithRetry(step, stepContext, step.maxReruns || 0);
          if (result && typeof result === "object")
            Object.assign(this.context, result);
          
          // Store step execution with its specific context
          this.completedSteps.push({ step, context: stepContext });
        }
      } catch (error) {
        console.log(`[Saga ${workflowDisplay}] Error occurred, starting compensation`);
        await this.compensate();
        throw error;
      }
    }
    console.log(`[Saga ${workflowDisplay}] Saga execution completed successfully`);
    return this.context;
  }

  private async compensate() {
    // Compensate in reverse order, handling groups
    const workflowDisplay = this.workflowName ? `${this.workflowName} (${this.runId})` : this.runId;
    console.log(`[Saga ${workflowDisplay}] Starting compensation`);
    try {
      for (const stepExecution of this.completedSteps.reverse()) {
        if (Array.isArray(stepExecution.step)) {
          // For parallel steps, compensate each substep with its own context
          const stepNames = stepExecution.step.map(s => s.name).join(', ');
          console.log(`[Saga ${workflowDisplay}] Compensating parallel steps: ${stepNames}`);
          const contexts = stepExecution.context as any[];
          await Promise.all(stepExecution.step.map((s, index) => {
            console.log(`[Saga ${workflowDisplay}] Compensating step: ${s.name}`);
            return s.compensate(contexts[index]);
          }));
        } else {
          // For sequential steps, compensate using their specific context
          console.log(`[Saga ${workflowDisplay}] Compensating step: ${stepExecution.step.name}`);
          await stepExecution.step.compensate(stepExecution.context as any);
        }
      }
    } catch (error) {
      console.error(`[Saga ${workflowDisplay}] Failed in compensate:`, error);
    } finally {
      if (this.lastCompensate) {
        console.log(`[Saga ${workflowDisplay}] Running global compensation`);
        await this.lastCompensate(this.context);
      }
      console.log(`[Saga ${workflowDisplay}] Compensation completed`);
    }
  }
}
