export type StepState = {
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensated';
  context: any;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  attempt: number;
  maxAttempts: number;
};

export type WorkflowState = {
  workflowName: string;
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';
  initialContext: any;
  currentContext: any;
  steps: StepState[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
};

export interface StateRepository {
  // Workflow state operations
  saveWorkflowState(state: WorkflowState): Promise<void>;
  getWorkflowState(runId: string): Promise<WorkflowState | null>;
  updateWorkflowState(runId: string, updates: Partial<WorkflowState>): Promise<void>;
  deleteWorkflowState(runId: string): Promise<void>;
  
  // Step state operations
  saveStepState(runId: string, stepState: StepState): Promise<void>;
  updateStepState(runId: string, stepName: string, updates: Partial<StepState>): Promise<void>;
  getStepState(runId: string, stepName: string): Promise<StepState | null>;
  
  // Query operations
  listRunningWorkflows(): Promise<WorkflowState[]>;
  listWorkflowsByName(workflowName: string): Promise<WorkflowState[]>;
  getWorkflowHistory(workflowName: string, limit?: number): Promise<WorkflowState[]>;
  
  // Cleanup operations
  cleanupCompletedWorkflows(olderThanDays: number): Promise<number>;
}

export class InMemoryStateRepository implements StateRepository {
  private workflowStates: Map<string, WorkflowState> = new Map();
  
  async saveWorkflowState(state: WorkflowState): Promise<void> {
    this.workflowStates.set(state.runId, { ...state });
  }
  
  async getWorkflowState(runId: string): Promise<WorkflowState | null> {
    const state = this.workflowStates.get(runId);
    return state ? { ...state } : null;
  }
  
  async updateWorkflowState(runId: string, updates: Partial<WorkflowState>): Promise<void> {
    const existing = this.workflowStates.get(runId);
    if (!existing) {
      throw new Error(`Workflow state not found for runId: ${runId}`);
    }
    
    this.workflowStates.set(runId, { ...existing, ...updates });
  }
  
  async deleteWorkflowState(runId: string): Promise<void> {
    this.workflowStates.delete(runId);
  }
  
  async saveStepState(runId: string, stepState: StepState): Promise<void> {
    const workflowState = this.workflowStates.get(runId);
    if (!workflowState) {
      throw new Error(`Workflow state not found for runId: ${runId}`);
    }
    
    // Find existing step state or add new one
    const existingIndex = workflowState.steps.findIndex(s => s.stepName === stepState.stepName);
    if (existingIndex >= 0) {
      workflowState.steps[existingIndex] = { ...stepState };
    } else {
      workflowState.steps.push({ ...stepState });
    }
  }
  
  async updateStepState(runId: string, stepName: string, updates: Partial<StepState>): Promise<void> {
    const workflowState = this.workflowStates.get(runId);
    if (!workflowState) {
      throw new Error(`Workflow state not found for runId: ${runId}`);
    }
    
    const stepIndex = workflowState.steps.findIndex(s => s.stepName === stepName);
    if (stepIndex === -1) {
      throw new Error(`Step state not found for stepName: ${stepName} in runId: ${runId}`);
    }
    
    workflowState.steps[stepIndex] = { ...workflowState.steps[stepIndex], ...updates };
  }
  
  async getStepState(runId: string, stepName: string): Promise<StepState | null> {
    const workflowState = this.workflowStates.get(runId);
    if (!workflowState) {
      return null;
    }
    
    const stepState = workflowState.steps.find(s => s.stepName === stepName);
    return stepState ? { ...stepState } : null;
  }
  
  async listRunningWorkflows(): Promise<WorkflowState[]> {
    return Array.from(this.workflowStates.values())
      .filter(state => state.status === 'running' || state.status === 'compensating')
      .map(state => ({ ...state }));
  }
  
  async listWorkflowsByName(workflowName: string): Promise<WorkflowState[]> {
    return Array.from(this.workflowStates.values())
      .filter(state => state.workflowName === workflowName)
      .map(state => ({ ...state }))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  
  async getWorkflowHistory(workflowName: string, limit: number = 50): Promise<WorkflowState[]> {
    const workflows = await this.listWorkflowsByName(workflowName);
    return workflows.slice(0, limit);
  }
  
  async cleanupCompletedWorkflows(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let deletedCount = 0;
    for (const [runId, state] of this.workflowStates.entries()) {
      if ((state.status === 'completed' || state.status === 'failed' || state.status === 'compensated') &&
          state.completedAt && state.completedAt < cutoffDate) {
        this.workflowStates.delete(runId);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
  
  // Additional utility methods for debugging and monitoring
  getStats(): {
    totalWorkflows: number;
    runningWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
  } {
    const states = Array.from(this.workflowStates.values());
    return {
      totalWorkflows: states.length,
      runningWorkflows: states.filter(s => s.status === 'running' || s.status === 'compensating').length,
      completedWorkflows: states.filter(s => s.status === 'completed').length,
      failedWorkflows: states.filter(s => s.status === 'failed').length
    };
  }
  
  clear(): void {
    this.workflowStates.clear();
  }
}