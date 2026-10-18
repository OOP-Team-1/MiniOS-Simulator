#pragma once

#include <string>
#include <vector>

// Small, dependency-free helpers shared by the engine's text protocols.
//
// Two things need encoding on both sides of the stdin/stdout pipe:
//   * base64 — so arbitrary user text (newlines, spaces, quotes, binary bytes)
//     can travel inside a single newline-terminated command/result line.
//   * JSON string escaping — so names coming from user input can never break
//     the telemetry / snapshot JSON objects the frontend parses.
namespace minios {

inline const std::string& base64Alphabet()
{
    static const std::string chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";
    return chars;
}

inline std::string base64Encode(const std::string& input)
{
    const std::string& chars = base64Alphabet();

    std::string out;
    out.reserve(((input.size() + 2) / 3) * 4);

    int val = 0;
    int valb = -6;

    for (unsigned char c : input)
    {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0)
        {
            out.push_back(chars[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }

    if (valb > -6)
    {
        out.push_back(chars[((val << 8) >> (valb + 8)) & 0x3F]);
    }

    while (out.size() % 4)
    {
        out.push_back('=');
    }

    return out;
}

inline std::string base64Decode(const std::string& input)
{
    const std::string& chars = base64Alphabet();

    std::vector<int> table(256, -1);
    for (int i = 0; i < 64; i++)
    {
        table[static_cast<unsigned char>(chars[i])] = i;
    }

    std::string out;
    int val = 0;
    int valb = -8;

    for (unsigned char c : input)
    {
        if (table[c] == -1) break; // padding '=' or invalid input stops decoding
        val = (val << 6) + table[c];
        valb += 6;
        if (valb >= 0)
        {
            out.push_back(static_cast<char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }

    return out;
}

inline std::string jsonEscape(const std::string& s)
{
    std::string out;
    out.reserve(s.size());

    for (char c : s)
    {
        switch (c)
        {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                // Control characters would be invalid inside a JSON string.
                if (static_cast<unsigned char>(c) < 0x20)
                {
                    static const char* hex = "0123456789abcdef";
                    out += "\\u00";
                    out += hex[(static_cast<unsigned char>(c) >> 4) & 0x0F];
                    out += hex[static_cast<unsigned char>(c) & 0x0F];
                }
                else
                {
                    out += c;
                }
                break;
        }
    }

    return out;
}

} // namespace minios
