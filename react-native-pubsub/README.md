# react-native-pubsub

## Getting started

`$ npm install react-native-pubsub --save`

### Mostly automatic installation

`$ react-native link react-native-pubsub`

### Manual installation


#### iOS

1. In XCode, in the project navigator, right click `Libraries` ➜ `Add Files to [your project's name]`
2. Go to `node_modules` ➜ `react-native-pubsub` and add `Pubsub.xcodeproj`
3. In XCode, in the project navigator, select your project. Add `libPubsub.a` to your project's `Build Phases` ➜ `Link Binary With Libraries`
4. Run your project (`Cmd+R`)<

#### Android

1. Open up `android/app/src/main/java/[...]/MainApplication.java`
  - Add `import com.reactlibrary.PubsubPackage;` to the imports at the top of the file
  - Add `new PubsubPackage()` to the list returned by the `getPackages()` method
2. Append the following lines to `android/settings.gradle`:
  	```
  	include ':react-native-pubsub'
  	project(':react-native-pubsub').projectDir = new File(rootProject.projectDir, 	'../node_modules/react-native-pubsub/android')
  	```
3. Insert the following lines inside the dependencies block in `android/app/build.gradle`:
  	```
      compile project(':react-native-pubsub')
  	```


## Usage
```javascript
import Pubsub from 'react-native-pubsub';

// TODO: What to do with the module?
Pubsub;
```
