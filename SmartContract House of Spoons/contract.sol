// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;



/**


  _    _                               __    _____                             
 | |  | |                             / _|  / ____|                            
 | |__| | ___  _   _ ___  ___    ___ | |_  | (___  _ __   ___   ___  _ __  ___ 
 |  __  |/ _ \| | | / __|/ _ \  / _ \|  _|  \___ \| '_ \ / _ \ / _ \| '_ \/ __|
 | |  | | (_) | |_| \__ \  __/ | (_) | |    ____) | |_) | (_) | (_) | | | \__ \
 |_|  |_|\___/ \__,_|___/\___|  \___/|_|   |_____/| .__/ \___/ \___/|_| |_|___/
                                                  | |                          
                                                  |_|                          


*/
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Staking is IERC721Receiver, Ownable {
    using Strings for uint256;

    address public constant collectionAddress = 0xB0181b32926646B96cd4d7E5474a609864e5FA8a;
    uint256 public constant GRACE_PERIOD = 60 * 60 * 24 * 3;
    uint256 public constant STAKE_MAX_PERIOD = 60 * 60 * 24 * 30;
    
    uint256 public dateFilled = 0;

    mapping(uint256 => uint256) public stakedTime;

    // Mapping from owner to list of owned token IDs
    mapping(address => mapping(uint256 => uint256)) public _ownedTokens;
    mapping(uint256 => address) _owners;
    mapping(address => uint256) public _balances;

    // Mapping from token ID to index of the owner tokens list
    mapping(uint256 => uint256) public _ownedTokensIndex;
    mapping(address => uint256) public lastClaimTime;
    uint256 public numberOfStaked;

    uint256[] public _allTokens;
    mapping(uint256 => uint256) public _allTokensIndex;
    mapping(address => uint256) public toClaim;

    function onERC721Received(address, address, uint256, bytes calldata) pure external override(IERC721Receiver) returns(bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }


    /* TESTING FUNCTIONS
    function changeFillUpDate(uint256 newFillUp) external onlyOwner{
        dateFilled = newFillUp;
    }

    function changeStakedTimeForToken(uint256 tokenId, uint256 newTime) external onlyOwner{
        stakedTime[tokenId] = newTime;
    }
    */
    // You can ignore the functions with _ at the start of their names
    function _addTokenToAllTokensEnumeration(uint256 tokenId) private {
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }

    function _removeTokenFromAllTokensEnumeration(uint256 tokenId) private {
        // To prevent a gap in the tokens array, we store the last token in the index of the token to delete, and
        // then delete the last slot (swap and pop).

        uint256 lastTokenIndex = _allTokens.length - 1;
        uint256 tokenIndex = _allTokensIndex[tokenId];

        // When the token to delete is the last token, the swap operation is unnecessary. However, since this occurs so
        // rarely (when the last minted token is burnt) that we still do the swap here to avoid the gas cost of adding
        // an 'if' statement (like in _removeTokenFromOwnerEnumeration)
        uint256 lastTokenId = _allTokens[lastTokenIndex];

        _allTokens[tokenIndex] = lastTokenId; // Move the last token to the slot of the to-delete token
        _allTokensIndex[lastTokenId] = tokenIndex; // Update the moved token's index

        // This also deletes the contents at the last position of the array
        delete _allTokensIndex[tokenId];
        _allTokens.pop();
    }

    function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
        uint256 length = _balances[to];
        _ownedTokens[to][length] = tokenId;
        _ownedTokensIndex[tokenId] = length;
        _balances[to]++;
        _addTokenToAllTokensEnumeration(tokenId);
        numberOfStaked++;
    }

    function _removeTokenFromOwnerEnumeration(address from, uint256 tokenId) private {
        // To prevent a gap in from's tokens array, we store the last token in the index of the token to delete, and
        // then delete the last slot (swap and pop).

        uint256 lastTokenIndex = _balances[from] - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];

        // When the token to delete is the last token, the swap operation is unnecessary
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];

            _ownedTokens[from][tokenIndex] = lastTokenId; // Move the last token to the slot of the to-delete token
            _ownedTokensIndex[lastTokenId] = tokenIndex; // Update the moved token's index
        }

        // This also deletes the contents at the last position of the array
        delete _ownedTokensIndex[tokenId];
        delete _ownedTokens[from][lastTokenIndex];
        _balances[from]--;
        _removeTokenFromAllTokensEnumeration(tokenId);
        numberOfStaked--;
    }


    // Returns all the token uris and token ids for a given user address that are not staked
    // inside the contract
    function tokenURIs(address targetAddress) public view returns(string[] memory, uint256[] memory){
        ERC721Enumerable collectionContract = ERC721Enumerable(collectionAddress);
        uint256 targetBalance = collectionContract.balanceOf(targetAddress);
        string [] memory uris = new string[](targetBalance); 
        uint256 [] memory tokenIds = new uint256[](targetBalance); 
        for(uint256 i = 0; i < targetBalance; i++){
            uint256 tokenId = collectionContract.tokenOfOwnerByIndex(targetAddress, i);
            uris[i] = collectionContract.tokenURI(tokenId);
            tokenIds[i] = tokenId;
        }
        return (uris, tokenIds);
    }

    function _min(uint256 a, uint256 b) private pure returns(uint256){
        return a >= b ? b : a;
    }


    // fill up, the reward ammount, calculates the rewards for each user based on
    // staking time. Only works 3 days after the previous fill up.
    function fillUp() external payable onlyOwner {
        require(block.timestamp-dateFilled > GRACE_PERIOD, "Filling up before grace period is over!");
        dateFilled = block.timestamp;
        uint256 leftOver = 0;
        uint256 maximumStakedAmmount = 0;
        uint256 perTokenReward = address(this).balance/_allTokens.length;
        for(uint256 i = 0; i < _allTokens.length; i++){
            toClaim[_owners[_allTokens[i]]] = 0;
        }
        for(uint256 i = 0; i < _allTokens.length; i++){
            uint256 tokenStakedTime = stakedTime[_allTokens[i]];
            uint256 diff = _min(dateFilled - tokenStakedTime, STAKE_MAX_PERIOD);
            uint256 toClaimForToken = (perTokenReward * diff) / STAKE_MAX_PERIOD;
            if(diff != STAKE_MAX_PERIOD){
                leftOver += perTokenReward - toClaimForToken;
            }else{
                maximumStakedAmmount++;
            }
            toClaim[_owners[_allTokens[i]]] += toClaimForToken;
            
        }
        uint256 maximumStakedTokenReward = leftOver/maximumStakedAmmount;
        for(uint256 i = 0; i < _allTokens.length; i++){
            uint256 tokenStakedTime = stakedTime[_allTokens[i]];
            if(dateFilled - tokenStakedTime >= STAKE_MAX_PERIOD){
                toClaim[_owners[_allTokens[i]]] += maximumStakedTokenReward;
            }
        }
    }

    // checks if the user can claim his reward. Should return true when 
    // the date of request is after the fill up date and before the grace period
    // also checks if the last claim time is before the fill up date
    function canClaim(address targetAddress) public view returns(bool){
        return block.timestamp > dateFilled && 
            block.timestamp-dateFilled <= GRACE_PERIOD &&
            lastClaimTime[targetAddress] < dateFilled;
    }
    
    // makes a claim request
    function claim() external{
        require(canClaim(msg.sender), "Error checking claim eligibility!");
        lastClaimTime[msg.sender] = block.timestamp;
        payable(msg.sender).transfer(toClaim[msg.sender]);
        toClaim[msg.sender] = 0;
    }

    function getRewardAmount(address targetAddress) external view returns(uint256) {
        return toClaim[targetAddress];
    }


    // transfer tokens from user to the contract for staking
    function stakeToken(uint256[]calldata tokenIds) external{
        ERC721Enumerable collectionContract = ERC721Enumerable(collectionAddress);
        for(uint256 i = 0; i < tokenIds.length; i++){
            stakedTime[tokenIds[i]] = block.timestamp;
            collectionContract.transferFrom(msg.sender, address(this), tokenIds[i]);
            _addTokenToOwnerEnumeration(msg.sender, tokenIds[i]);
            _owners[tokenIds[i]] = msg.sender;
        }
    }

    // same as tokenUris but only for the staked
    function getStaked(address targetAddress) external view returns (string[] memory, uint256[] memory) {
        string [] memory uris = new string[](_balances[targetAddress]); 
        uint256 [] memory tokenIds = new uint256[](_balances[targetAddress]); 
        for(uint256 i = 0; i < _balances[targetAddress]; i++){
            tokenIds[i] = _ownedTokens[targetAddress][i];
            uris[i] =  ERC721Enumerable(collectionAddress).tokenURI(tokenIds[i]);
        }
        return (uris, tokenIds);
    }

    // tranfers the token back to the user from the contract
    function unstake(uint256[]calldata tokenIds) external {
        for(uint256 i = 0; i < tokenIds.length; i++){
            require(_owners[tokenIds[i]] == msg.sender, "Trying to unstake unowned token!");
            stakedTime[tokenIds[i]] = 0;
            IERC721(collectionAddress).transferFrom(address(this), msg.sender, tokenIds[i]);
            _removeTokenFromOwnerEnumeration(msg.sender, tokenIds[i]);
            _owners[tokenIds[i]] = address(0);
        }
    }

    function withdraw() external onlyOwner {
        require(payable(msg.sender).send(address(this).balance));
    }
}
