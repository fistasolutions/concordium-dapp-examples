import { useEffect, useRef, useState } from 'react';
import { version } from '../../../package.json';
import BackButton from '../elements/BackButton';
import '../../styles/ConnectWallet.scss';
import '../../styles/ProgressStep.scss';
import '../../styles/Proof.scss';
import { useNavigate } from 'react-router-dom';
import { Container, Button, Row, Col } from 'react-bootstrap';

import { Check } from 'lucide-react';
import SkeletonLoading from './Skeleton';
import { useWallet } from '../../context/WalletContext';
import ProgressStep from '../connect-wallet/ProgressStep';
import {
    AccountAddress,
    ConcordiumGRPCClient,
    CredentialDeploymentValues,
    CredentialStatement,
} from '@concordium/web-sdk';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';
import { getStatement, submitZkProof } from '../../apiReqeuests';
import { getRecentBlock } from '../../utils';
import { CONTEXT_STRING } from '../../constants';
import sha256 from 'sha256';

const Proof = () => {
    const navigate = useNavigate();
    const { provider, connectedAccount } = useWallet();
    const [verifyProgress, setVerifyProgress] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const grpcClient = useRef(new ConcordiumGRPCClient(new GrpcWebFetchTransport({ baseUrl: CONFIG.node }))).current;
    const capitalizedNetwork = CONFIG.network[0].toUpperCase() + CONFIG.network.substring(1);

    const [zkStatement, setZkStatement] = useState<CredentialStatement | undefined>(undefined);

    useEffect(() => {
        const fetchStatement = async () => {
            const statement: CredentialStatement = await getStatement();
            setZkStatement(statement);
        };

        fetchStatement();
    }, []);

    const handleVerify = async () => {
        setIsLoading(true);
        try {
            if (!zkStatement) {
                throw Error(`'zkStatement' is undefined.`);
            }

            if (!provider || !connectedAccount) {
                throw Error(
                    `'provider' or 'prover' are undefined. Connect your wallet. Have an account in your wallet.`,
                );
            }
            const { blockHash: recentBlockHash, blockHeight: recentBlockHeight } = await getRecentBlock(grpcClient);

            const digest = [recentBlockHash.buffer, Buffer.from(CONTEXT_STRING)];

            // The zk proof request here is non-interactive (we don't request the challenge from the backend).
            // Instead the challenge consists of a recent block hash (so that the proof expires)
            // and a context string (to ensure the ZK proof cannot be replayed on different Concordium services).
            const challenge = sha256(digest.flatMap((item) => Array.from(item)));

            // Generate the ZK proof.
            const presentation = await provider.requestVerifiablePresentation(challenge, [zkStatement]);

            const accountInfoProver = await grpcClient?.getAccountInfo(AccountAddress.fromBase58(connectedAccount));

            const credIdConnectedAccount = (
                accountInfoProver?.accountCredentials[0].value.contents as CredentialDeploymentValues
            ).credId;

            // Check that the ZK proof was generated by the account address that is connected to this dApp.
            if (
                credIdConnectedAccount !==
                presentation.verifiableCredential[0].credentialSubject.id.replace(
                    /did:ccd:(mainnet|testnet):cred:/g,
                    '',
                )
            ) {
                throw Error(
                    `When approving the ZK proof in the wallet, select your connected account from the drop-down menu in the wallet (expect proof for account: ${connectedAccount}).`,
                );
            }

            await submitZkProof(presentation, recentBlockHeight);
        } catch (error) {
            console.log('error', error);
        }

        // After verification
        setTimeout(() => {
            setIsLoading(false);
            setVerifyProgress(true);
        }, 1000);
    };
    return (
        <Container fluid className="d-flex flex-column min-vh-100 text-light bg-dark" style={{ position: 'relative' }}>
            {isLoading ? (
                <SkeletonLoading />
            ) : (
                <>
                    {/* <BackButton redirectURL={'/tweetPost'} /> */}
                    <div className="d-flex align-items-center">
                        <BackButton redirectURL={'/tweetPost'} />
                        <Button
                            onClick={async () => {
                                const account: string | null = connectedAccount;
                                if (account) {
                                    await navigator.clipboard.writeText(account);
                                    if (CONFIG.network === 'testnet') {
                                        window.open(
                                            `https://testnet.ccdscan.io/?dcount=1&dentity=account&daddress=${connectedAccount}`,
                                            '_blank',
                                        );
                                    } else {
                                        window.open(
                                            `https://ccdscan.io/?dcount=1&dentity=account&daddress=${connectedAccount}`,
                                            '_blank',
                                        );
                                    }
                                }
                            }}
                            variant="primary"
                            className="ms-auto mt-2 account-button text-black bg-theme"
                        >
                            {connectedAccount
                                ? connectedAccount.slice(0, 5) + '...' + connectedAccount.slice(-5)
                                : 'No Account Connected'}
                        </Button>
                    </div>
                    <div className="d-flex justify-content-center mb-3">
                        <a
                            target="_blank"
                            rel="noreferrer"
                            href={`https://github.com/Concordium/concordium-dapp-examples/tree/main/compliant-reward-distribution`}
                        >
                            Version {version} ({capitalizedNetwork})
                        </a>
                    </div>
                    <div className="d-flex justify-content-center mb-3">
                        <ProgressStep number={1} active={true} />
                        <ProgressStep number={2} active={true} />
                        <ProgressStep number={3} active={true} />
                    </div>
                    <Container className="connect-wallet-container text-center pt-2">
                        <h1 className="connect-wallet-title">Proof of eligibility</h1>
                        <div className="verification-container mb-5">
                            {verifyProgress ? (
                                <Container className="user-info-container w-339 space-y-2">
                                    <Row>
                                        <Col>
                                            <p className="label-text">User name</p>
                                            <p className="info-text border-bottom">John Douglas</p>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col>
                                            <p className="label-text">Passport number</p>
                                            <p className="info-text border-bottom">US991298</p>
                                        </Col>
                                    </Row>

                                    <Row>
                                        <Col>
                                            <p className="label-text">Age</p>
                                            <div className="d-flex align-items-center border-bottom">
                                                <Check size={20} className="text-green mr-2" />
                                                <p className="info-text mt-3">Over 18 years old</p>
                                            </div>
                                        </Col>
                                    </Row>

                                    <Row>
                                        <Col>
                                            <p className="label-text mt-2">Your country</p>
                                            <div className="d-flex align-items-center border-bottom">
                                                <Check size={20} className="text-green mr-2" />
                                                <p className="info-text">Eligible nationality</p>
                                            </div>
                                        </Col>
                                    </Row>
                                </Container>
                            ) : (
                                <div className="w-full">
                                    <p className="text-gray-300 text-[12px] font-normal font-satoshi-sans mb-[8px]">
                                        To collect your reward, you must verify the below data
                                        <br /> using your ConcordiumID.
                                    </p>

                                    <ul className="space-y-2 text-gray-300">
                                        <li className="verification-list-item">
                                            <span className="bullet"></span>
                                            Your full name
                                        </li>
                                        <li className="verification-list-item">
                                            <span className="bullet"></span>
                                            Your ID number
                                        </li>
                                        <li className="verification-list-item">
                                            <span className="bullet"></span>
                                            That you are over 18 years old
                                        </li>
                                        <li className="verification-list-item">
                                            <span className="bullet"></span>
                                            That your nationality is eligible *
                                        </li>
                                    </ul>

                                    <p className="note-text text-[12px] font-normal pt-[29px] text-gray-400 font-satoshi-sans">
                                        * Not eligible nationalities are: USA, Iran, North Korea, occupied regions of
                                        Ukraine.
                                    </p>
                                </div>
                            )}
                        </div>
                    </Container>
                    <div className="d-flex justify-content-center mb-3">
                        {' '}
                        {/* Flex container to center the button */}
                        {verifyProgress ? (
                            <Button
                                onClick={() => {
                                    navigate('/submission');
                                }}
                                variant="light"
                                className="px-5 py-3 rounded-pill bg-white text-black fw-semibold"
                                style={{ width: '239px', height: '56px' }}
                            >
                                Finish
                            </Button>
                        ) : (
                            <Button
                                onClick={() => {
                                    handleVerify();
                                }}
                                variant="light"
                                className="px-5 py-3 rounded-pill bg-white text-black fw-semibold"
                                style={{ width: '239px', height: '56px' }}
                            >
                                Verify
                            </Button>
                        )}
                    </div>
                </>
            )}
        </Container>
    );
};

export default Proof;
