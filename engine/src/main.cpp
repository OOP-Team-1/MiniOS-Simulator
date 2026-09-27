#include<iostream>
#include"../include/Process.h"

using namespace std;

int main()
{
    Process p("p1","Chrome",5,0,10);
    cout<<p.getPID()<<endl;
    cout<<p.getName()<<endl;
    cout<<p.getState()<<endl;
    cout<<p.getPriority()<<endl;
    cout<<p.getArrivalTime()<<endl;
    cout<<p.getBurstTime()<<endl;
    cout<<p.getRemainingTime()<<endl;
}