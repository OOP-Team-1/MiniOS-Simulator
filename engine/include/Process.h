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
    public:
        Process(std::string PID,std::string name,int priority,int arrivalTime,int burstTime);
        std::string getPID() const;
        std::string getName() const;
        std::string getState() const;
        int getPriority() const;
        int getArrivalTime() const;
        int getBurstTime() const;
        int getRemainingTime() const;
        void setState(ProcessState state);
        void execute(int timeUnits);
};