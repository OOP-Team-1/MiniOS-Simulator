#include "../include/Directory.h"

Directory::Directory(const std::string& dirId,
                      const std::string& name,
                      const std::string& parentDirId,
                      int createdAt)
    : dirId(dirId), name(name), parentDirId(parentDirId), createdAt(createdAt)
{
}

std::string Directory::getDirId() const { return dirId; }
std::string Directory::getName() const { return name; }
std::string Directory::getParentDirId() const { return parentDirId; }
int Directory::getCreatedAt() const { return createdAt; }

void Directory::setName(const std::string& newName) { name = newName; }
void Directory::setParentDirId(const std::string& newParentDirId) { parentDirId = newParentDirId; }