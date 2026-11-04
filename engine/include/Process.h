#pragma once
#include<string>

enum class ProcessState
{
    NEW,
    READY,
    RUNNING,
    BLOCKED,
    TERMINATED
};

class Process
{
    private:
        std::string PID;
        std::string name;
        ProcessState state;
        int priority;
        int arrivalTime;
        int burstTime;
        int remainingTime;
        int memoryRequired;

        // ── CFS / scheduling statistics ────────────────────────────────────
        // These fields are maintained by the scheduling loop (SimulationEngine
        // / Kernel) and consumed by CFSScheduler. Keeping them on the PCB
        // means every scheduler can share the same process representation.
        double vruntime;        // accumulated weighted virtual runtime
        int weight;             // scheduling weight (higher = more CPU share)
        int firstRunTime;       // start of the first CPU slice (-1 = never run)
        int completionTime;     // tick at which the process terminated (-1)
        int totalCpuTime;       // total ticks actually executed

    public:
        Process(std::string PID,std::string name,int priority,int arrivalTime,int burstTime,int memoryRequired,int weight=10);
        std::string getPID() const;
        std::string getName() const;
        std::string getState() const;
        int getPriority() const;
        int getArrivalTime() const;
        int getBurstTime() const;
        int getRemainingTime() const;
        int getMemoryRequired() const;
        void setState(ProcessState state);
        void execute(int timeUnits);

        // CFS / metrics accessors
        double getVruntime() const;
        int getWeight() const;
        int getFirstRunTime() const;
        int getCompletionTime() const;
        int getTotalCpuTime() const;

        void setVruntime(double value);
        void addVruntime(double delta);
        void setWeight(int value);

        // Scheduling-loop bookkeeping. markFirstRun() is idempotent, so it is
        // safe to call before every slice; only the first call records a time.
        void markFirstRun(int time);
        void markCompleted(int time);
        void addCpuTime(int timeUnits);

        // Clears per-run statistics while preserving the PCB and its state.
        void resetSchedulingStats();

        // Rewinds execution for a fresh simulation run: restores the full burst,
        // returns to NEW (the engine re-admits arrived processes) and clears all
        // scheduling statistics. The PCB identity and configuration are kept.
        void resetForRestart();

        // Derived metrics (return 0 until the relevant timestamps are known).
        int getWaitingTime() const;
        int getTurnaroundTime() const;
        int getResponseTime() const;
};
