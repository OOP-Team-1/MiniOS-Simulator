#pragma once

#include <string>

// A real directory entry — not a path string.
// Directories form a tree via parentDirId; the root directory has parentDirId == "" (empty string).
class Directory
{
private:
    std::string dirId;
    std::string name;
    std::string parentDirId;
    int createdAt;

public:
    Directory(const std::string& dirId,
               const std::string& name,
               const std::string& parentDirId,
               int createdAt);

    std::string getDirId() const;
    std::string getName() const;
    std::string getParentDirId() const;
    int getCreatedAt() const;

    void setName(const std::string& newName);
    void setParentDirId(const std::string& newParentDirId);
};