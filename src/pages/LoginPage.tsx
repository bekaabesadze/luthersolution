import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";
import styles from "./LoginPage.module.css";

export function LoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(password);
            // On success, client.ts stores the token. Redirect to upload.
            navigate("/upload");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Admin Login</h1>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <label className={styles.label}>
                        <span className={styles.labelText}>Password</span>
                        <input
                            type="password"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter admin password"
                            autoFocus
                            required
                        />
                    </label>
                    <button type="submit" className={styles.button} disabled={loading || !password}>
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </form>
                {error && <div className={styles.error}>{error}</div>}
            </div>
        </div>
    );
}
