<!--
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
-->

# Instruction to setup the development environment

1. install npm

2. Git clone 3 repos : https://github.com/puneetgkaur/cordova-cli, https://github.com/puneetgkaur/cordova-lib, https://github.com/puneetgkaur/cordova-plugman into a directory

3. Run the following commands:

        cd cordova-plugman
    
        npm install
    
        sudo npm link
    
        cd ..
    
        cd cordova-lib
    
        npm install
    
        sudo npm link
    
        cd ..
    
        cd cordova-cli
    
        npm install
    
        sudo npm link
    
        npm link ../cordova-lib/cordova-lib cordova-lib
    
        npm link ../cordova-plugman/ plugman



# commands used to develop a sugar app using cordova

## creating a project

    cordova create "project directory" "project id" "project name"


this creates a cordova project in current dir\"project directory" as you specify above. The project id and name of the project - that is the name of the sugar activity is set using the project name variable.

## Add ths sugar platform to your project

    cordova platform add sugar

After this, develop your sugar activity by modifying the project dir\www folder - place where the web app lies. Once the modification is through, build the project by following commands.

## building the project

### Normal build with no extra toolbox buttons
When you dont want to add any extra tool button then use the default option and issue the following command :

    cordova build sugar

### Adding extra toolbutton

If you have added extra toolbutton then compile your app using the following command :

    cordova build sugar -- noiframe


Once you are succesfully build the project, you would find the .xo kept in project dir\platforms\sugar\cordova directory which you can copy and paste into sugar-build folder and run the command sugar-install-bundle "project name".xo
