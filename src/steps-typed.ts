import { createTypedStep } from "./package/saga";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Step with specific input/output types

export const userStep = createTypedStep<
  {},
  { userId: string; username: string }
>({
  name: "createUser",
  action: async (context: any) => {
    // context is typed as {}
    await delay(100);

    console.log("Action User Step, context:", context);
    console.log("Creating user with ID: user123 and username: john_doe");
    return { userId: "user123", username: "john_doe" };
  },
  compensate: async (context: any) => {
    // context is typed as {}
    console.log("Compensate User Step, context:", context);
    console.log("Rolling back user creation");
  },
});

// Next step that expects the user data
export const paymentStep = createTypedStep<
  { userId: string; username: string },
  { paymentId: string }
>({
  name: "processPayment",
  action: async (context: { username: any; userId: any }) => {
    await delay(100);
    // context is typed with userId and username
    console.log("Action Payment Step, context:", context);
    console.log(
      `Processing payment for user ${context.username} (${context.userId})`
    );
    return { paymentId: "pay123" };
  },
  compensate: async (context: { username: any; userId: any }) => {
    // context has the original user data for compensation
    console.log("Compensate Payment Step, context:", context);
    console.log(
      `Refunding payment for user ${context.username} (${context.userId})`
    );
  },
});

// Step to send notification email
export const notificationStep = createTypedStep<
  { userId: string; username: string; paymentId: string },
  { notificationId: string }
>({
  name: "sendNotification",
  action: async (context: { username: any; paymentId: any }) => {
    await delay(100);
    console.log("Action Notification Step, context:", context);
    console.log(
      `Sending confirmation email to user ${context.username} for payment ${context.paymentId}`
    );
    return { notificationId: "notif456" };
  },
  compensate: async (context: { username: any }) => {
    console.log("Compensate Notification Step, context:", context);
    console.log(`Cancelling notification for user ${context.username}`);
  },
});

// Step to update user profile/status
export const profileUpdateStep = createTypedStep<
  {
    userId: string;
    username: string;
    paymentId: string;
    notificationId: string;
  },
  { profileUpdated: boolean; timestamp: number }
>({
  name: "updateProfile",
  action: async (context: { username: any; paymentId: any }) => {
    await delay(100);
    console.log("Action Profile Update Step, context:", context);
    console.log(
      `Updating profile for user ${context.username} after successful payment ${context.paymentId}`
    );
    const timestamp = Date.now();
    return { profileUpdated: true, timestamp };
  },
  compensate: async (context: { username: any }) => {
    console.log("Compensate Profile Update Step, context:", context);
    console.log(`Reverting profile changes for user ${context.username}`);
  },
});

// Final step to log completion
export const auditLogStep = createTypedStep<
  {
    userId: string;
    username: string;
    paymentId: string;
    notificationId: string;
    profileUpdated: boolean;
    timestamp: number;
  },
  { auditId: string }
>({
  name: "auditLog",
  action: async (context: {
    username: any;
    paymentId: any;
    timestamp: string | number | Date;
  }) => {
    await delay(50);
    console.log("Action Audit Log Step, context:", context);
    console.log(
      `Creating audit log for completed transaction - User: ${
        context.username
      }, Payment: ${context.paymentId}, Timestamp: ${new Date(
        context.timestamp
      ).toISOString()}`
    );
    // throw new Error("");
    return { auditId: "audit789" };
  },
  compensate: async (context: { username: any }) => {
    console.log("Compensate Audit Log Step, context:", context);
    console.log(
      `Removing audit log for failed transaction - User: ${context.username}`
    );
  },
});
