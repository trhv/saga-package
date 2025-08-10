import { BasicSaga } from "./workflow-controller";

async function main() {
  const basicSaga = new BasicSaga();
  // await basicSaga.runSaga();
  await basicSaga.runSagaWithSkip();
  
}

main();
