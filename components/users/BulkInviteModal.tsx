"use client";

import { useState, useRef } from "react";
import { UserRole, IBulkInviteResult } from "@/lib/models";

interface BulkInviteModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedInvite {
  email: string;
  name: string;
  valid: boolean;
  error?: string;
}

export function BulkInviteModal({ onClose, onSuccess }: BulkInviteModalProps) {
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [inputText, setInputText] = useState("");
  const [parsedInvites, setParsedInvites] = useState<ParsedInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IBulkInviteResult | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseEmails = (text: string): ParsedInvite[] => {
    // Split by newlines, commas, or semicolons
    const lines = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return lines.map((line) => {
      // Check if it's "Name <email>" format or "email, name" format or just email
      const bracketMatch = line.match(/^(.+?)\s*<([^>]+)>$/);
      const commaMatch = line.match(/^([^,]+),\s*(.+)$/);

      let email = "";
      let name = "";

      if (bracketMatch) {
        name = bracketMatch[1].trim();
        email = bracketMatch[2].trim();
      } else if (commaMatch) {
        // Could be "email, name" or "name, email"
        if (emailRegex.test(commaMatch[1].trim())) {
          email = commaMatch[1].trim();
          name = commaMatch[2].trim();
        } else if (emailRegex.test(commaMatch[2].trim())) {
          name = commaMatch[1].trim();
          email = commaMatch[2].trim();
        }
      } else if (emailRegex.test(line)) {
        email = line;
        name = line.split("@")[0]; // Use email prefix as name
      }

      if (!email || !emailRegex.test(email)) {
        return { email: line, name: "", valid: false, error: "Invalid email" };
      }

      return { email, name, valid: true };
    });
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.trim()) {
      setParsedInvites(parseEmails(text));
    } else {
      setParsedInvites([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleTextChange(text);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    const validInvites = parsedInvites.filter((i) => i.valid);
    if (validInvites.length === 0) {
      setError("No valid emails to send");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitations: validInvites.map((i) => ({
            email: i.email,
            name: i.name,
            role,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitations");
      }

      setResult(data as IBulkInviteResult);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedInvites.filter((i) => i.valid).length;
  const invalidCount = parsedInvites.filter((i) => !i.valid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-4">Invite Users</h2>

        {result ? (
          <div className="space-y-4">
            {/* Results */}
            <div className={`p-4 rounded-lg ${result.success ? "bg-green-50" : "bg-yellow-50"}`}>
              <p className={`font-medium ${result.success ? "text-green-800" : "text-yellow-800"}`}>
                {result.success ? "All invitations sent!" : "Some invitations failed"}
              </p>
              <p className={`text-sm mt-1 ${result.success ? "text-green-700" : "text-yellow-700"}`}>
                {result.sent} sent, {result.failed} failed
              </p>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Failed Invitations
                </label>
                <div className="border border-gray-200 rounded-lg max-h-[150px] overflow-y-auto">
                  {result.errors.map((err, index) => (
                    <div
                      key={index}
                      className={`px-3 py-2 text-sm ${
                        index !== result.errors.length - 1 ? "border-b border-gray-100" : ""
                      }`}
                    >
                      <span className="text-gray-900">{err.email}</span>
                      <span className="text-red-500 ml-2">- {err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (result?.success && onSuccess) {
                  onSuccess();
                }
                onClose();
              }}
              className="w-full py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            {/* Role Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invite as
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole(UserRole.STUDENT)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                    role === UserRole.STUDENT
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole(UserRole.ADMIN)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                    role === UserRole.ADMIN
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Admin
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {role === UserRole.ADMIN
                  ? "Admins can manage bookings and approve requests."
                  : "Students can book available classrooms."}
              </p>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Addresses
              </label>
              <textarea
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={`Enter emails (one per line, comma-separated, or CSV format):

john@example.com
Jane Doe <jane@example.com>
bob@example.com, Bob Smith`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px] text-sm"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Supports: email, "Name &lt;email&gt;", or "email, name" formats
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Upload CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Preview */}
            {parsedInvites.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Preview ({validCount} valid{invalidCount > 0 && `, ${invalidCount} invalid`})
                  </label>
                </div>
                <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
                  {parsedInvites.map((invite, index) => (
                    <div
                      key={index}
                      className={`px-3 py-2 text-sm flex items-center justify-between ${
                        index !== parsedInvites.length - 1 ? "border-b border-gray-100" : ""
                      } ${!invite.valid ? "bg-red-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className={invite.valid ? "text-gray-900" : "text-red-600"}>
                          {invite.email}
                        </span>
                        {invite.name && invite.name !== invite.email.split("@")[0] && (
                          <span className="text-gray-500 ml-2">({invite.name})</span>
                        )}
                      </div>
                      {!invite.valid && (
                        <span className="text-xs text-red-500 ml-2">{invite.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || validCount === 0}
              className={`w-full py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50 ${
                role === UserRole.ADMIN
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading
                ? "Sending Invitations..."
                : `Send ${validCount} Invitation${validCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
