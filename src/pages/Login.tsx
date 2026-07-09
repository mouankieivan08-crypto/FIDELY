import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { CreditCard, Mail } from "lucide-react";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");
      await signInWithGoogle(); // redirects to Google; user comes back on /dashboard
    } catch (err: any) {
      setError("Échec de la connexion : " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CreditCard className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connexion à FIDELY
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Gérez le programme de fidélité de votre entreprise
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div>
            <button
              onClick={handleLogin}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Mail className="mr-2 h-5 w-5" />
              Continuer avec Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
