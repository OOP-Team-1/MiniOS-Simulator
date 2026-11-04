#pragma once

#include <map>
#include <string>
#include <vector>

#include "Scheduler.h"

// Educational Completely Fair Scheduler.
//
// Every runnable process owns a virtual runtime (vruntime) on its PCB. The
// scheduler always picks the process with the smallest vruntime, and the CPU
// execution loop (SimulationEngine / Kernel) reports executed ticks back via
// onProcessExecuted(), which grows vruntime proportionally to
//
//     delta_vruntime = executed_ticks * base_weight / process_weight
//
// Higher-weight processes therefore accumulate virtual time more slowly and
// receive a larger CPU share. Time slices are derived from the configured
// target latency and the total weight of the current runnable set, clamped by
// a minimum scheduling granularity.
//
// This is a compact teaching model; it intentionally does not reproduce every
// detail of the Linux kernel's CFS implementation (red-black tree, load
// tracking, group scheduling, ...).
class CFSScheduler : public Scheduler
{
private:
    double targetLatency;
    double minGranularity;
    double baseWeight;

    std::string currentPID;
    int currentSlice;
    int remainingSlice;

    int runnableCount;
    double minVruntime;
    int preemptionCount;
    std::string lastReason;

    // PIDs that have already been placed on the virtual timeline, mapped to
    // their most recent vruntime. New tasks inherit the current minimum
    // vruntime so they neither gain an unfair advantage nor starve behind
    // long-running tasks.
    std::map<std::string, double> knownTasks;

    double totalWeight(const std::vector<Process*>& ready) const;
    int computeSlice(const Process* process, const std::vector<Process*>& ready) const;
    Process* pickMinVruntime(const std::vector<Process*>& ready) const;

public:
    CFSScheduler(double targetLatency = 24.0,
                 double minGranularity = 3.0,
                 double baseWeight = 10.0);

    SchedulingDecision selectNextProcess(const std::vector<Process*>& processes) override;
    void onProcessExecuted(Process& process, int timeUnits) override;
    void onProcessCompleted(Process& process) override;
    void reset() override;

    std::string getName() const override { return "CFS"; }
    std::string getDecisionReason() const override { return lastReason; }
    std::string getTelemetryJson() const override;

    void setParameters(double targetLatency, double minGranularity);

    double getTargetLatency() const { return targetLatency; }
    double getMinGranularity() const { return minGranularity; }
    double getBaseWeight() const { return baseWeight; }
};
