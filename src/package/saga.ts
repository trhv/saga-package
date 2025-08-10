type SagaContext = Record<string, any>;

export type Step<TInput = SagaContext, TOutput = SagaContext> = {
  name: string;
  action: (context: TInput) => Promise<Partial<TOutput> | void>;
  compensate: (context: TInput) => Promise<void>;
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

  async execute(initialContext: any = {}): Promise<any> {
    // Generate a new GUID for this run
    this.runId = crypto.randomUUID();
    console.log(`[Saga ${this.runId}] Starting saga execution`);
    
    this.context = { ...initialContext };
    for (const step of this.steps) {
      // Create a separate context for this step (copy of current global context)
      const stepContext = { ...this.context };
      
      try {
        if (Array.isArray(step)) {
          // Parallel execution - each substep gets its own context copy
          const stepNames = step.map(s => s.name).join(', ');
          console.log(`[Saga ${this.runId}] Executing parallel steps: ${stepNames}`);
          
          const stepContexts = step.map(() => ({ ...this.context }));
          const results = await Promise.all(
            step.map((s, index) => {
              console.log(`[Saga ${this.runId}] Running step: ${s.name}`);
              return s.action(stepContexts[index]);
            })
          );
          
          // Merge all results into global context
          results.forEach((result) => {
            if (result && typeof result === "object")
              Object.assign(this.context, result);
          });
          
          // Store step execution with all contexts used by parallel steps
          this.completedSteps.push({ step, context: stepContexts });
        } else {
          // Sequential execution
          console.log(`[Saga ${this.runId}] Running step: ${step.name}`);
          const result = await step.action(stepContext);
          if (result && typeof result === "object")
            Object.assign(this.context, result);
          
          // Store step execution with its specific context
          this.completedSteps.push({ step, context: stepContext });
        }
      } catch (error) {
        console.log(`[Saga ${this.runId}] Error occurred, starting compensation`);
        await this.compensate();
        throw error;
      }
    }
    console.log(`[Saga ${this.runId}] Saga execution completed successfully`);
    return this.context;
  }

  private async compensate() {
    // Compensate in reverse order, handling groups
    console.log(`[Saga ${this.runId}] Starting compensation`);
    try {
      for (const stepExecution of this.completedSteps.reverse()) {
        if (Array.isArray(stepExecution.step)) {
          // For parallel steps, compensate each substep with its own context
          const stepNames = stepExecution.step.map(s => s.name).join(', ');
          console.log(`[Saga ${this.runId}] Compensating parallel steps: ${stepNames}`);
          const contexts = stepExecution.context as any[];
          await Promise.all(stepExecution.step.map((s, index) => {
            console.log(`[Saga ${this.runId}] Compensating step: ${s.name}`);
            return s.compensate(contexts[index]);
          }));
        } else {
          // For sequential steps, compensate using their specific context
          console.log(`[Saga ${this.runId}] Compensating step: ${stepExecution.step.name}`);
          await stepExecution.step.compensate(stepExecution.context as any);
        }
      }
    } catch (error) {
      console.error(`[Saga ${this.runId}] Failed in compensate:`, error);
    } finally {
      if (this.lastCompensate) {
        console.log(`[Saga ${this.runId}] Running global compensation`);
        await this.lastCompensate(this.context);
      }
      console.log(`[Saga ${this.runId}] Compensation completed`);
    }
  }
}
