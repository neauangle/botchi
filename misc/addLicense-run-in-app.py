import os
import sys
import re

#you'll have to add logic to remove the current copyright statement if you update it later (ie 2023). I can't be arsed.
#also, manually remove the license from frontend/js/third_party

COPYLEFT_MESSAGE = """/*
Copyright (C) 2022 https://github.com/neauangle (neauangle@protonmail.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

"""


counter = 0
for root, dirs, files in os.walk(os.getcwd()):
    for name in files:
        if name.endswith(".js") or name.endswith(".ts"):
            full_name = os.path.join(root, name)
            content = COPYLEFT_MESSAGE
            with open(full_name, 'r', encoding="utf-8") as fr:
                content += fr.read()
            with open(full_name, 'w', encoding="utf-8") as fw:
                fw.write(content)
print("done")



