#pragma once
#include<vector>
#include"Process.h"
#include<string>

struct SchedulingDecision
{
    std::string PID;
    int timeUnits;
};

class Scheduler
{
    public:
        virtual SchedulingDecision selectNextProcess(const std::vector<Process*>& processes)=0;

        // Called by the scheduling loop after the CPU executed `process` for
        // `timeUnits`. Stateful schedulers (CFS) use this to accumulate
        // virtual runtime and slice bookkeeping without owning the CPU.
        virtual void onProcessExecuted(Process& process, int timeUnits)
        {
            (void)process;
            (void)timeUnits;
        }

        // Called once when a process reaches TERMINATED.
        virtual void onProcessCompleted(Process& process)
        {
            (void)process;
        }

        virtual void reset() {}

        // Identifier used by the telemetry layer ("CFS", "RR", ...).
        virtual std::string getName() const { return "GENERIC"; }

        // Human-readable explanation of the most recent selection. CFS
        // overrides this so the UI can explain *why* a process was picked.
        virtual std::string getDecisionReason() const { return ""; }

        // Algorithm-specific telemetry object (JSON). Must be a single JSON
        // object; the default is an empty object.
        virtual std::string getTelemetryJson() const { return "{}"; }

        virtual ~Scheduler()=default;
};
