import { useState, type FormEvent } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { PrimaryButton } from '../components/common/Buttons';
import { api } from '../services/api';

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('Sending to the local API…');
    try {
      const result = await api.contact(form);
      setStatus(result.message);
      setForm({ name: '', email: '', message: '' });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The local API could not receive the message.');
    }
  }
  return (
    <PageContainer eyebrow="Feedback channel" title="Send a local test message" intro="This form validates through the local Express API. It does not send email or transmit beyond your computer.">
      <form className="contact-form" onSubmit={submit}>
        <label>Name<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Message<textarea required minLength={10} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        <PrimaryButton type="submit">Submit to local API</PrimaryButton>
        {status && <p className="form-status" role="status">{status}</p>}
      </form>
    </PageContainer>
  );
}
