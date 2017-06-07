Here's a general overview of how the plugins in this directory are dependent on each other:

          F
         / \
        A   \      B
       / \   \    / \
      C   '---D--'   E


   G <-> H

I -> C@1.0.0

Test1 --> cordova-plugin-file@2.0.0
Test2 --> cordova-plugin-file@2.X.0
Test3 --> cordova-plugin-file@3.0.0
Test4 --> cordova-plugin-file@https://github.com/apache/cordova-plugin-file

