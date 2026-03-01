import { usePuterStore } from "~/lib/puter";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

export const meta = () => ([{ title: "Resumind | Auth" }, { name: "description", content: "Log in to your account" },])

const Auth = () => {
    const { isLoading, error, auth } = usePuterStore();
    const location = useLocation();
    const next = location.search.split("next=")[1];
    const navigate = useNavigate();

    useEffect(() => {
        if (auth.isAuthenticated) navigate(next);
    }, [auth.isAuthenticated, next]);

    return (<main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen flex items-center justify-center">
        <div className="gradient-border shadow-lg">
            <section className="flex flex-col gap-8 rounded-2xl p-10 max-w-lg w-full">
                <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-4xl max-sm:text-2xl">Welcome</h1>
                    <h2 className="text-xl max-sm:text-base">Log In to Continue Your Job Journey</h2>
                </div>

                {error ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="bg-red-100 border border-red-300 text-red-800 rounded-xl p-4 text-sm leading-relaxed">
                            <p className="font-semibold mb-1">⚠️ Connection Error</p>
                            <p>{error}</p>
                        </div>
                        <button
                            className="auth-button w-full text-xl py-3"
                            onClick={() => window.location.reload()}
                        >
                            🔄 Retry
                        </button>
                    </div>
                ) : (
                    <div>
                        {isLoading ? (
                            <button className="auth-button animate-pulse w-full text-2xl py-3">
                                <p>Connecting to Puter...</p>
                            </button>
                        ) : (
                            <>
                                {auth.isAuthenticated ? (
                                    <button className="auth-button w-full text-2xl py-3" onClick={() => auth.signOut()}>
                                        <p>Log out</p>
                                    </button>
                                ) : (
                                    <button className="auth-button w-full text-2xl py-3" onClick={() => auth.signIn()}>
                                        <p>Log in</p>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </section>
        </div>
    </main>);
};

export default Auth;
