"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ApproveTimesheetPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timesheet, setTimesheet] = useState<any>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing token.");
      setLoading(false);
      return;
    }
    // Fetch timesheet details by token
    fetch("/api/timesheet/fetch-by-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        setTimesheet(data.timesheet);
        setLoading(false);
      })
      .catch((err) => {
        setError("Invalid or expired link.");
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }
    if (action === "reject" && !note) {
      setError("Rejection note is required.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/timesheet/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, note, name, email }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess(
        action === "approve"
          ? "Timesheet approved. Thank you!"
          : "Timesheet rejected. The technician will be notified."
      );
    } else {
      setError(data.error || "An error occurred.");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (success) return <div className="p-8 text-center text-green-600">{success}</div>;

  return (
    <div className="max-w-xl mx-auto p-8 bg-white rounded shadow mt-8">
      <h1 className="text-2xl font-bold mb-4">Timesheet Approval</h1>
      <div className="mb-4">
        <strong>Date:</strong> {timesheet.entryDate}<br />
        <strong>Technician:</strong> {timesheet.technicianId}<br />
        <strong>Notes:</strong> {timesheet.taskNotes}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-2">
          <label className="block mb-1">Your Name</label>
          <input className="border p-2 w-full" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="mb-2">
          <label className="block mb-1">Your Email</label>
          <input className="border p-2 w-full" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="mb-4">
          <button type="button" className={`mr-2 px-4 py-2 rounded ${action==='approve'?'bg-green-600 text-white':'bg-gray-200'}`} onClick={() => setAction("approve")}>Approve</button>
          <button type="button" className={`px-4 py-2 rounded ${action==='reject'?'bg-red-600 text-white':'bg-gray-200'}`} onClick={() => setAction("reject")}>Reject</button>
        </div>
        {action === "reject" && (
          <div className="mb-2">
            <label className="block mb-1">Rejection Note</label>
            <textarea className="border p-2 w-full" value={note} onChange={e => setNote(e.target.value)} required />
          </div>
        )}
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded" disabled={!action || loading}>
          Submit
        </button>
      </form>
    </div>
  );
}
