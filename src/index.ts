import { BasicSaga } from "./workflow-controller";

async function main() {
  const basicSaga = new BasicSaga();
  
  console.log("=== Traditional Saga Usage ===");
  // await basicSaga.runSaga();
  // await basicSaga.runSagaWithSkip();
  // await basicSaga.runSagaWithRetry();
  // await basicSaga.runWithGlobalCompensate();
  
  console.log("\n=== Named Workflow Usage ===");
  
  // List available workflows
  basicSaga.listAllWorkflows();
  
  // Run different named workflows
  await basicSaga.runNamedWorkflow("user-onboarding", 123);
  await basicSaga.runNamedWorkflow("user-onboarding-skip-payment", 456);
  await basicSaga.runNamedWorkflow("user-onboarding-with-retry", 789);
  
  // Demonstrate workflow reuse
  await basicSaga.demonstrateWorkflowReuse();
  
  // Show final statistics
  console.log("\n=== Final Workflow Statistics ===");
  basicSaga.listAllWorkflows();
}

main().catch(console.error);
