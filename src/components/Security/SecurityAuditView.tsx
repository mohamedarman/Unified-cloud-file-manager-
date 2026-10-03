import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Trash2,
  FileCode,
  CheckCircle,
  Eye,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { Redactor } from '../../utils/redactor';
import { formatDate } from '../../utils/formatters';

export const SecurityAuditView: React.FC = () => {
  const { auditLogs, clearAuditLogs, accounts } = useFileManager();

  // Interactive Redactor tester
  const [testInput, setTestInput] = useState(
    'Account alex.dev@gmail.com initialized session with token ya29.a0AfH6SM92xKLa827419827361 and secret GOCSPX-abc123secret99 at content://com.unifiedcloud.filemanager.documents/root/1/file_doc_01'
  );

  const [testAccountId, setTestAccountId] = useState(1);
  const [testFileId, setTestFileId] = useState('doc_spec_01');

  const scrubbedOutput = Redactor.scrub(testInput);
  const correlationTag = Redactor.fileRefTag(testAccountId, testFileId);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Security & Redacted Audit Logs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict redaction of credentials, email domains, URIs, and FNV-1a correlation tags (Redactor.kt & Architecture.md §31)
          </p>
        </div>

        <button
          onClick={clearAuditLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Logs</span>
        </button>
      </div>

      {/* Redactor Interactive Demonstration */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Live Log Redaction Sandbox (Pure Redactor.kt implementation)
            </h3>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Rules.md §26 Enforced
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Type or edit the message below containing sample OAuth access tokens (<code>ya29...</code>), client secrets (<code>GOCSPX-...</code>), or email addresses. Observe how the redactor scrubs sensitive tokens automatically.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Raw Log Message Input (Simulated application trace)
            </label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Safe Sanitized Output (Ready for storage / sink)
            </label>
            <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-xs font-mono break-all border border-slate-800">
              {scrubbedOutput}
            </div>
          </div>

          {/* Correlation Tag Generator */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Account ID</span>
              <input
                type="number"
                value={testAccountId}
                onChange={(e) => setTestAccountId(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Provider File ID</span>
              <input
                type="text"
                value={testFileId}
                onChange={(e) => setTestFileId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Generated Tag (12-char FNV-1a)</span>
              <div className="bg-slate-100 text-slate-800 px-2 py-1 rounded-lg font-mono font-semibold border border-slate-200">
                refTag#{correlationTag}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">
              Runtime Audit Logs ({auditLogs.length} events)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Hardware Keystore & token lifecycle audit
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No audit log entries recorded yet. Perform file or account operations to view logs.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => {
                const account = accounts.find((a) => a.localId === log.accountId);
                return (
                  <div key={log.id} className="p-3.5 hover:bg-slate-50/70 transition flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            log.severity === 'ERROR'
                              ? 'bg-rose-100 text-rose-800'
                              : log.severity === 'WARN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {log.severity}
                        </span>

                        <span className="font-semibold text-slate-800 font-mono text-[11px]">
                          {log.action}
                        </span>

                        {account && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            {account.badgeLabel}
                          </span>
                        )}

                        <span className="font-mono text-[10px] text-slate-400">
                          #{log.correlationTag}
                        </span>
                      </div>

                      <p className="text-slate-600 font-mono text-[11px] break-all">
                        {log.redactedMessage}
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
