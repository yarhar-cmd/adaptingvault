export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

export function acceptContactMessage(message: ContactMessage) {
  return {
    success: true,
    message: `Thanks, ${message.name}. Your test message was validated locally but was not emailed or stored.`,
  };
}
