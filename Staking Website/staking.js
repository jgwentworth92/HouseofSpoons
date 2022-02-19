let contract = null;
const config = {
    contractAddress: '0x2ea4001bd658e99740B606Ebe77c17241DFEe59B',
    networkName: 'Polygon Mainnet',
    etherScanUrl: 'https://polygonscan.com/tx/',
    openSeaUrl: 'https://opensea.io/account',
    networkParams: {
        chainId: '0x89'
    },
    contractABI: [
        "function claim() external",
        "function getRewardAmount(address targetAddress) external view returns(uint256)",
        "function stakeToken(uint256 []calldata tokenIds) external",
        "function getStaked(address targetAddress) external view returns (string[] memory, uint256[] memory)",
        "function unstake(uint256 []calldata tokenIds) external",
        "function canClaim(address targetAddress) public view returns(bool)",
        "function collectionAddress() public view returns(address)",
        "function tokenURIs(address targetAddress) public view returns(string[] memory, uint256[] memory)",
    ]
};


let targetContract = null;
let collectionContractAddress = null;

let targetAbi = [
    "function isApprovedForAll(address owner, address operator) public view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) public",
];

// fill up info

async function sendTransaction(data, transactionFuncName, contractABI, contractAddress) {
    const modal = document.querySelector('.nft-modal');
    modal.classList.add('open');

    const modalContainer = modal.querySelector('.nft-modal-container');

    modalContainer.innerHTML = `
      <div class="nft-modal-content">
        <svg height="32" width="32">
          <circle cx="16" cy="16" fill="none" r="14" stroke="#34C77B" stroke-dasharray="87.96459430051421" stroke-dashoffset="74.76990515543707" stroke-width="4" class="nft-modal-stage-loading"></circle>
        </svg>
      </div>
    `;

    function displayError(error) {
        modalContainer.innerHTML = `
        <div class="nft-modal-content">
          ${error}
        </div>
      `;
        return false;
    };

    if (!(await verifyWalletConnection())) {
        return displayError('Error with MetaMask. Please refresh and try again.');
    }
    const modalContent = modal.querySelector('.nft-modal-content');

    const iface = new ethers.utils.Interface(contractABI);
    const params = iface.encodeFunctionData(transactionFuncName, data);
    try {
        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: window.ethereum.selectedAddress,
                to: contractAddress,
                value: "0x0",
                data: params
            }, ],
        });
        modalContent.innerHTML = `Transaction submitted. Please wait for confirmation.
        <br>
        Transaction hash: ${txHash}
        <br>
        <a target="_blank" href="${config.etherScanUrl}${txHash}">View on EtherScan</a>
        <br>
        <svg height="32" width="32">
          <circle cx="16" cy="16" fill="none" r="14" stroke="#34C77B" stroke-dasharray="87.96459430051421" stroke-dashoffset="74.76990515543707" stroke-width="4" class="nft-modal-stage-loading"></circle>
        </svg>`;
        const tx = await (new ethers.providers.Web3Provider(window.ethereum)).getTransaction(txHash);
        const txReceipt = await tx.wait();
        modal.classList.remove('open');
        return true;
    } catch (err) {
        console.log(err);
        return displayError("Error with Transaction. Please refresh and try again!");
    }
}

async function verifyWalletConnection({ noAlert } = {}) {
    if (!window.ethereum) {
        console.log('Please install MetaMask to interact with this feature');
        return;
    }

    if (!window.ethereum.selectedAddress && noAlert && localStorage.getItem('verifyWalletRequested') === '1') {
        return;
    }

    // localStorage.setItem('verifyWalletRequested', '1');
    let accounts;
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: config.networkParams.chainId }], // chainId must be in hexadecimal numbers
        });
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        if (window.ethereum.chainId != config.networkParams.chainId) {
            console.log(`Please switch MetaMask network to ${config.networkName}`);
            return;
        }
    } catch (error) {
        if (error.code == -32002) {
            console.log('Please open your MetaMask and select an account');
            return;
        } else if (error.code == 4001) {
            console.log('Please connect with MetaMask');
            return;
        } else {
            throw error;
        }
    }
    console.log("main contract address", `[${config.contractAddress}]`);
    contract = new ethers.Contract(config.contractAddress, config.contractABI, new ethers.providers.Web3Provider(window.ethereum));
    collectionContractAddress = await contract.collectionAddress();
    console.log("target contract adress", `[${collectionContractAddress}]`);
    targetContract = new ethers.Contract(collectionContractAddress, targetAbi, new ethers.providers.Web3Provider(window.ethereum));
    return accounts[0];
}

async function isApprovedForAll() {
    let approveBtn = document.getElementById("approveBtn");
    let approved = await targetContract.isApprovedForAll(window.ethereum.selectedAddress, config.contractAddress)
    if (!approved) {
        approveBtn.setAttribute("disabled", true);
        let data = [config.contractAddress, true];
        approved = await sendTransaction(data, "setApprovalForAll", targetAbi, collectionContractAddress);
        approveBtn.removeAttribute("disabled");
    }
    return approved;
}

async function updateClaimAmmount() {
    if (document.getElementById("claimBtn")) {
        let ethToClaim = ethers.utils.formatEther(await contract.getRewardAmount(window.ethereum.selectedAddress));
        document.getElementById("claimAmmount").innerText = `${ethToClaim} eth to claim!`;
    }
}

async function init() {
    let showStakable = document.getElementById("showStakable")
    let showStaked = document.getElementById("showStaked");

    function createTokenImage(tokenURI, dataId, root, i, imgClass) {
        tokenURI = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/")
        fetch(tokenURI)
            .then(res => res.json())
            .then(out => {
                let parrentDiv = document.createElement("div");
                let img = new Image();
                img.src = out.image.replace("ipfs://", "https://ipfs.io/ipfs/")
                parrentDiv.classList.add("bktibx");
                parrentDiv.classList.add(imgClass);
                parrentDiv.style.order = i;
                parrentDiv.setAttribute("dataId", dataId);
                parrentDiv.appendChild(img);
                root.appendChild(parrentDiv)
                parrentDiv.addEventListener("click", function() {
                    if (parrentDiv.classList.contains("unstaked")) {
                        parrentDiv.classList.remove("unstaked");
                        parrentDiv.classList.add("staked");
                    } else if (parrentDiv.classList.contains("staked")) {
                        parrentDiv.classList.add("unstaked");
                        parrentDiv.classList.remove("staked");
                    }
                });
            });
    }

    // CREATE TOKEN IMAGES
    console.log("user address", `[${window.ethereum.selectedAddress}]`);
    let getTokenUris = (await contract.tokenURIs(window.ethereum.selectedAddress));
    getTokenUris[0].forEach((tokenURI, i) => {
        createTokenImage(tokenURI, getTokenUris[1][i], showStakable, i, "unstaked")
    });


    console.log("GOT AVAILABLE TOKENS");
    let getStaked = (await contract.getStaked(window.ethereum.selectedAddress));
    getStaked[0].forEach((tokenURI, i) => {
        createTokenImage(tokenURI, getStaked[1][i], showStaked, i, "staked");
    });
    console.log("GOT STAKED");
    let stakeBtn = document.getElementById("stakeBtn");

    async function stakeTransaction(fromElement, toElement, className, transactionFuncName) {
        let tokens = [];
        let tokenChildren = fromElement.getElementsByClassName(className)
        Array.from(tokenChildren).forEach((el) => {
            tokens.push(+el.getAttribute("dataId"));
        });
        console.log(tokens);
        if (await sendTransaction([tokens], transactionFuncName, config.contractABI, config.contractAddress)) {
            Array.from(tokenChildren).forEach((el) => {
                toElement.appendChild(el);
            });
        }
    }
    stakeBtn.addEventListener("click", async function() {
        await stakeTransaction(showStakable, showStaked, "staked", "stakeToken");
        await updateClaimAmmount()
    });
    let unstakeBtn = document.getElementById("unstakeBtn");
    unstakeBtn.addEventListener("click", async function() {
        await stakeTransaction(showStaked, showStakable, "unstaked", "unstake");
        await updateClaimAmmount()
    });

    const claimBtn = document.getElementById("claimBtn");
    if (await contract.canClaim(window.ethereum.selectedAddress)) {
        claimBtn.removeAttribute("disabled");
        claimBtn.addEventListener("click", async() => {
            if (await sendTransaction([], "claim", config.contractABI, config.contractAddress)) {
                document.getElementById("claimAmmount").innerText = "Nothing to claim!";
                claimBtn.remove();
            }
        });
    } else {
        document.getElementById("claimAmmount").innerText = "Nothing to claim!";
        claimBtn.remove();
    }

    console.log("CLAIM CHECKED");
    await updateClaimAmmount()
    console.log("UPDATED claim ammount");

    document.getElementById("content").classList.remove("hidden");
    Array.from(document.getElementsByClassName("bstimeslider")).forEach((view) => {
        let show = $(view.querySelector(".viewContainer>.tslshow"));
        var sliderLimit = -($(show).width() - $(view).width());
        console.log(sliderLimit)
        let moveLength = $(view.querySelector(".viewContainer")).width();
        let animating = false;
        view.querySelector(".rightArrow").addEventListener("click", function() {
            var currentPosition = parseInt(show.css("left"));
            let movedAmmount = moveLength;
            if (currentPosition - movedAmmount < sliderLimit) { movedAmmount = Math.abs(sliderLimit - currentPosition) }
            if (currentPosition >= sliderLimit && !animating) {
                animating = true;
                show.stop(false, true).animate({
                    left: "-=" + movedAmmount + "px"
                }, {
                    duration: 400,
                    complete: () => {
                        animating = false
                    }

                });
            }

        });

        view.querySelector(".leftArrow").addEventListener("click", function() {
            var currentPosition = parseInt(show.css("left"));
            let movedAmmount = moveLength;
            if (currentPosition + movedAmmount >= 0) { movedAmmount = Math.abs(currentPosition) }
            if (currentPosition < 0 && !animating) {
                animating = true;
                show.stop(false, true).animate({
                    left: "+=" + movedAmmount + "px"
                }, {
                    duration: 400,
                    complete: () => {
                        animating = false
                    }
                });
            }
        });
    });
}

$(document).ready(function() {
    let modal = document.createElement("div");
    modal.innerHTML = `<div class="nft-modal">
        <div class="nft-modal-overlay nft-js-modal-overlay"></div>
        <div class="nft-modal-container"></div>
    </div>`
    document.body.appendChild(modal);

    document.getElementById("checkWalletConnection").addEventListener("click", async() => {
        if (await verifyWalletConnection()) {
            document.getElementById("checkWalletConnection").remove();
            let approveBtn = document.getElementById("approveBtn");
            console.log("main user address", `[${window.ethereum.selectedAddress}]`);
            console.log("main contract address", `[${config.contractAddress}]`);
            if (await targetContract.isApprovedForAll(window.ethereum.selectedAddress, config.contractAddress)) {
                approveBtn.remove();
                console.log("approved");
                await init();
            } else {
                approveBtn.classList.remove("hidden");
                approveBtn.addEventListener("click", async() => {
                    if (await isApprovedForAll()) {
                        approveBtn.remove();
                        await init();
                    }
                });
            }

        }
    });
});