import { Saga } from "./saga";
import { StateRepository } from "./state-repository";

export type WorkflowExecutionResult = {
  workflowName: string;
  runId: string;
  success: boolean;
  finalContext: any;
  error?: Error;
  executedAt: Date;
};

export type WorkflowDefinition = {
  name: string;
  saga: Saga;
  createdAt: Date;
  lastExecutedAt?: Date;
  executionHistory: WorkflowExecutionResult[];
};

export class WorkflowManager {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private stateRepository?: StateRepository;

  constructor(options?: { stateRepository?: StateRepository }) {
    this.stateRepository = options?.stateRepository;
  }

  // Register a named workflow
  registerWorkflow(name: string, saga: Saga): WorkflowManager {
    if (this.workflows.has(name)) {
      throw new Error(`Workflow with name "${name}" already exists`);
    }

    saga.setWorkflowName(name);
    if (this.stateRepository) {
      saga.setStateRepository(this.stateRepository);
    }
    const definition: WorkflowDefinition = {
      name,
      saga: saga.clone(), // Store a clean copy
      createdAt: new Date(),
      executionHistory: []
    };

    this.workflows.set(name, definition);
    return this;
  }

  // Update an existing workflow (replaces the saga definition)
  updateWorkflow(name: string, saga: Saga): WorkflowManager {
    if (!this.workflows.has(name)) {
      throw new Error(`Workflow with name "${name}" does not exist`);
    }

    const definition = this.workflows.get(name)!;
    saga.setWorkflowName(name);
    if (this.stateRepository) {
      saga.setStateRepository(this.stateRepository);
    }
    definition.saga = saga.clone(); // Replace with new clean copy
    this.workflows.set(name, definition);
    return this;
  }

  // Run a workflow by name
  async runWorkflow(name: string, initialContext: any = {}): Promise<WorkflowExecutionResult> {
    const definition = this.workflows.get(name);
    if (!definition) {
      throw new Error(`Workflow with name "${name}" does not exist`);
    }

    // Clone the saga to avoid modifying the stored definition
    const sagaInstance = definition.saga.clone();
    if (this.stateRepository) {
      sagaInstance.setStateRepository(this.stateRepository);
    }
    const startTime = new Date();

    let result: WorkflowExecutionResult;

    try {
      const finalContext = await sagaInstance.execute(initialContext);
      result = {
        workflowName: name,
        runId: sagaInstance.getRunId(),
        success: true,
        finalContext,
        executedAt: startTime
      };
    } catch (error) {
      result = {
        workflowName: name,
        runId: sagaInstance.getRunId(),
        success: false,
        finalContext: {},
        error: error as Error,
        executedAt: startTime
      };
    }

    // Update execution history
    definition.lastExecutedAt = startTime;
    definition.executionHistory.push(result);

    // Keep only last 10 executions to avoid memory bloat
    if (definition.executionHistory.length > 10) {
      definition.executionHistory = definition.executionHistory.slice(-10);
    }

    if (!result.success) {
      throw result.error;
    }

    return result;
  }

  // Get workflow definition
  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  // List all registered workflows
  listWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  // Get workflow execution history
  getWorkflowHistory(name: string): WorkflowExecutionResult[] {
    const definition = this.workflows.get(name);
    return definition ? [...definition.executionHistory] : [];
  }

  // Remove a workflow
  removeWorkflow(name: string): boolean {
    return this.workflows.delete(name);
  }

  // Get workflow statistics
  getWorkflowStats(name: string): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastExecutedAt?: Date;
    averageExecutionTime?: number;
  } | undefined {
    const definition = this.workflows.get(name);
    if (!definition) {
      return undefined;
    }

    const history = definition.executionHistory;
    const totalExecutions = history.length;
    const successfulExecutions = history.filter(r => r.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      lastExecutedAt: definition.lastExecutedAt
    };
  }

  // Clear all workflows
  clear(): void {
    this.workflows.clear();
  }
}