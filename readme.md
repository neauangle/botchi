Note: Botchi is in **open beta**. 

# What is Botchi?
Botchi is a **free and open-source** desktop (Mac, Windows and Linux) **bot suite** currently able to communicate with the Binance CEX and Ethereum-address-compatible blockchains such as Ethereum, Fantom, Binance Smart Chain and Avalanche-C. 

There are **no associated tokens, fees or user accounts**. I have attempted to make Botchi accessible for non-programmers while providing a powerful platform for developers to use, learn from and extend. 

![Screenshot](misc/screenshot_01.png?raw=true)

# What can you do with it? 
Quite a lot! It can be used to build different **automatic trading strategies** by **dragging and dropping** prebuilt **modular components**. These can be arranged in many ways, resulting in many different kinds of bots- from simple trail bots and grid-based strategies to bots with complicated stop-loss contingencies or even bots managed by other bots in a hierarchy of control. 

But you could also, for example, **run your own auto-compounder** that performs a certain set of tasks at a specific time each day. You can even communicate with defi contracts directly to play or **test interactive contracts** without needing a specific web3.0 app.

Since all bot logic is handled in Botchi, you can **implement limit orders without locking up your funds** as you would placing such orders on a CEX. Quantities for trades can also be given as percentages of whatever your wallet balance is at the time a swap is triggered. In fact, you could run bots for different token pairs using the same wallet principle with a first-in-best-dressed approach. You can also use Botchi as an accounting abstraction layer over a single wallet or account to run multiple “virtual wallets” with their own principle and compounding pools.  

I have tried to make a versatile tool which anyone can use. More than that, the ability to **write and share custom modules** and **import/export bot groups and workspaces** will hopefully result in use cases and strategies I haven’t even though of!

Download [documentation.pdf](https://github.com/neauangle/botchi/blob/master/documentation.pdf) to get a more comprehensive look at what Botchi is and how it works.

# Installation
### For developers
Botchi is an Electron app- which is to say, it's a node.js app. Installation should be as simple as downloading the source code and running `npm install` to install dependencies.
### For non-developers
Go to the [Releases](https://github.com/neauangle/botchi/releases) page. The releases are listed with the newest release first. Click the Assets expando for the newest release, download archive for your system, unzip the contents and move it to *C:/Program Files/* (or wherever). 
