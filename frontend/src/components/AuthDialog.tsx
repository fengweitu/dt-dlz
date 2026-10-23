import { useState, type FormEvent } from "react";
import { Modal, ErrorText } from "./Common";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import type { User } from "../lib/types";
export function AuthDialog() {
  const s = useStore(),
    [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await s.signIn(
        await api<User>(
          register ? "/register" : "/login",
          "POST",
          Object.fromEntries(new FormData(e.currentTarget)),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={register ? "Create your account." : "Welcome to AURELIS."}
      onClose={() => s.setAuthOpen(false)}
    >
      <p className="modal-subtitle">
        Your orders, delivery addresses and saved peptides, in one place.
      </p>
      <form className="form-grid" onSubmit={submit}>
        {register && (
          <label>
            Full name
            <input name="name" required maxLength={40} autoComplete="name" />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={register ? 8 : 1}
            maxLength={register ? 72 : 128}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        <ErrorText error={error} />
        <button className="btn full" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        <button
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Already have an account? Sign in" : "Create an account"}
        </button>
      </p>
    </Modal>
  );
}
